import { browser } from "$app/environment";
import { invokeAiChat } from "$utils/backend";
import { getActiveAiInvokePayload } from "$utils/ai";
import type { AiProviderId, DiaryEntry } from "../types";
import type { Locale } from "./i18n";

const GREETING_CACHE_KEY = "echonote-hero-greeting";
const MAX_CONTEXT_ENTRIES = 30;
const MAX_SUMMARY_LENGTH = 180;

interface CachedHeroGreeting {
  date: string;
  locale: Locale;
  signature: string;
  greeting: string;
}

interface HeroGreetingOptions {
  today: Date;
  locale: Locale;
  entries: DiaryEntry[];
}

export async function generateHeroGreeting(
  options: HeroGreetingOptions,
): Promise<string | null> {
  if (!browser) return null;

  const { today, locale, entries } = options;
  const todayIso = formatIsoDate(today);
  const signature = buildSignature(entries);
  const cached = readCachedGreeting();

  if (
    cached &&
    cached.date === todayIso &&
    cached.locale === locale &&
    cached.signature === signature
  ) {
    return cached.greeting;
  }

  const aiConfig = await getActiveAiInvokePayload();
  const providerId = aiConfig?.providerId as AiProviderId | undefined;
  if (!aiConfig || !providerId || providerId === "noai") return null;

  const context = buildContext(entries);
  const system = buildSystemPrompt(locale, aiConfig.prompt);
  const user = buildUserPrompt(todayIso, locale, context);

  const response = await invokeAiChat({
    providerId,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: aiConfig.temperature ?? undefined,
    maxTokens: Math.min(aiConfig.maxTokens ?? 60, 80),
  });

  const greeting = response.content?.trim();
  if (!greeting) return null;

  persistGreeting({
    date: todayIso,
    locale,
    signature,
    greeting,
  });

  return greeting;
}

function buildContext(entries: DiaryEntry[]): string {
  if (!entries.length) return "";

  const recent = [...entries]
    .filter((entry) => Boolean(entry.aiSummary))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_CONTEXT_ENTRIES);

  return recent
    .map((entry) => {
      const normalized = normalizeSummary(entry.aiSummary ?? "");
      return `${entry.date}: ${normalized}`;
    })
    .join("\n");
}

function buildSystemPrompt(locale: Locale, preference?: string | null): string {
  const language = resolveLanguage(locale);
  const lines = [
    "You write a single warm hero greeting for a personal diary app.",
    "Keep it concise (ideally within 24 characters), optimistic, and free of emoji or markdown.",
    `Respond in ${language} only.`,
  ];
  if (preference?.trim()) {
    lines.push(`User preference: ${preference.trim()}`);
  }
  return lines.join("\n");
}

function buildUserPrompt(todayIso: string, locale: Locale, context: string): string {
  const trimmedContext = context || "No AI summaries were provided in the past month.";
  return [
    `Today's date: ${todayIso}`,
    `Locale: ${locale}`,
    "Recent AI summaries for the past month:",
    trimmedContext,
    "Generate a greeting that reflects the tone of these summaries while encouraging today's writing.",
  ].join("\n");
}

function formatIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readCachedGreeting(): CachedHeroGreeting | null {
  if (!browser) return null;
  const raw = localStorage.getItem(GREETING_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedHeroGreeting;
    if (
      parsed &&
      typeof parsed.date === "string" &&
      typeof parsed.greeting === "string" &&
      typeof parsed.signature === "string"
    ) {
      return parsed;
    }
  } catch (_error) {
    return null;
  }
  return null;
}

function persistGreeting(payload: CachedHeroGreeting): void {
  if (!browser) return;
  localStorage.setItem(GREETING_CACHE_KEY, JSON.stringify(payload));
}

function buildSignature(entries: DiaryEntry[]): string {
  const base = entries
    .filter((entry) => Boolean(entry.aiSummary))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_CONTEXT_ENTRIES)
    .map((entry) => `${entry.date}:${entry.aiSummary ?? ""}`)
    .join("|");

  return hashString(base);
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function normalizeSummary(value: string): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  if (compacted.length <= MAX_SUMMARY_LENGTH) return compacted;
  return `${compacted.slice(0, MAX_SUMMARY_LENGTH)}…`;
}

function resolveLanguage(locale: Locale): string {
  switch (locale) {
    case "en":
      return "English";
    case "ja":
      return "Japanese";
    case "zh-TW":
      return "Traditional Chinese";
    case "zh-CN":
    default:
      return "Simplified Chinese";
  }
}
