import { browser } from "$app/environment";
import { invokeGenerateHeroGreeting } from "$utils/backend";
import { DEFAULT_GREETING_PROMPT, getActiveAiInvokePayload } from "$utils/ai";
import type { AiProviderId, DiaryEntry } from "../types";
import type { Locale } from "./i18n";

const GREETING_CACHE_KEY = "echonote-hero-greeting";
const MAX_CONTEXT_ENTRIES = 30;
const MAX_SUMMARY_LENGTH = 180;
const MAX_TOKENS = 80;

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

  const aiConfig = await getActiveAiInvokePayload();
  const providerId = aiConfig?.providerId as AiProviderId | undefined;
  if (!aiConfig || !providerId || providerId === "noai") return null;

  const greetingPrompt = resolveGreetingPrompt(
    aiConfig.greetingPrompt ?? aiConfig.prompt,
  );
  const maxTokens = clampMaxTokens(aiConfig.maxTokens);
  const temperature = normalizeTemperatureValue(aiConfig.temperature);
  const timezone = resolveTimezoneLabel();

  const signature = buildSignature(
    entries,
    providerId,
    greetingPrompt,
    temperature,
    maxTokens,
    timezone,
  );
  const cached = readCachedGreeting();

  if (
    cached &&
    cached.date === todayIso &&
    cached.locale === locale &&
    cached.signature === signature
  ) {
    return cached.greeting;
  }

  const response = await invokeGenerateHeroGreeting({
    providerId,
    userPrompt: greetingPrompt,
    locale,
    date: todayIso,
    maxTokens,
    temperature,
    timezone,
  });

  const greeting = extractGreetingFromResponse(response);
  if (!greeting) return null;

  persistGreeting({
    date: todayIso,
    locale,
    signature,
    greeting,
  });

  return greeting;
}

function resolveGreetingPrompt(preference?: string | null): string {
  const trimmed = preference?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_GREETING_PROMPT;
}

function formatIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveTimezoneLabel(): string {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const offsetLabel = formatOffsetLabel(offsetMinutes);
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "";
  if (tz && tz.trim()) {
    return `${tz} (${offsetLabel})`;
  }
  return offsetLabel;
}

function formatOffsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const minutes = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
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

function buildSignature(
  entries: DiaryEntry[],
  providerId: AiProviderId,
  prompt: string,
  temperature?: number | null,
  maxTokens?: number | null,
  timezone?: string | null,
): string {
  const entriesFingerprint = entries
    .filter((entry) => Boolean(entry.aiSummary))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_CONTEXT_ENTRIES)
    .map((entry) => `${entry.date}:${normalizeSummary(entry.aiSummary ?? "")}`)
    .join("|");

  const configFingerprint = JSON.stringify({
    providerId,
    prompt,
    temperature: typeof temperature === "number" ? Math.round(temperature * 100) / 100 : null,
    maxTokens: maxTokens ?? null,
    timezone: timezone ?? null,
  });

  return hashString(`${configFingerprint}|${entriesFingerprint}`);
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

function clampMaxTokens(value?: number | null): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.min(Math.floor(value), MAX_TOKENS);
}

function normalizeTemperatureValue(value?: number | null): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(value, 2));
}

function extractGreetingFromResponse(content?: string | null): string | null {
  if (!content) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string") {
      return parsed.trim() || null;
    }
    if (parsed && typeof parsed === "object") {
      const candidate =
        (parsed as Record<string, unknown>).greeting ??
        (parsed as Record<string, unknown>).message ??
        (parsed as Record<string, unknown>).text;
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  } catch (_error) {
    const match = trimmed.match(/"greeting"\s*:\s*"([^"]+)"/i);
    if (match) return match[1].trim();
  }
  return trimmed;
}
