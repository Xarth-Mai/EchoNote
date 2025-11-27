import { browser } from "$app/environment";
import { invokeGenerateHeroGreeting } from "$utils/backend";
import { DEFAULT_GREETING_PROMPT, getActiveAiInvokePayload } from "$utils/ai";
import type { AiProviderId } from "../types";
import type { Locale } from "./i18n";

const GREETING_CACHE_KEY = "echonote-hero-greeting";

interface CachedGreetingBucket {
  date: string;
  locales: Record<string, CachedHeroGreeting>;
}

interface CachedHeroGreeting {
  signature: string;
  greeting: string;
}

interface HeroGreetingOptions {
  today: Date;
  locale: Locale;
}

export async function generateHeroGreeting(
  options: HeroGreetingOptions,
): Promise<string | null> {
  if (!browser) return null;

  const { today, locale } = options;
  const todayIso = formatIsoDate(today);

  const aiConfig = await getActiveAiInvokePayload();
  const providerId = aiConfig?.providerId as AiProviderId | undefined;
  if (!aiConfig || !providerId || providerId === "noai") return null;

  const greetingPrompt = resolveGreetingPrompt(
    aiConfig.greetingPrompt ?? aiConfig.prompt,
  );
  const maxTokens = aiConfig.maxTokens;
  const temperature = normalizeTemperatureValue(aiConfig.temperature);
  const timezone = resolveTimezoneLabel();

  const signature = buildSignature(providerId, greetingPrompt, temperature, maxTokens, timezone);
  const cached = readCachedGreeting(todayIso, locale, signature);
  if (cached) return cached;

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

  persistGreeting(todayIso, locale, {
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

function readCachedBucket(): CachedGreetingBucket | null {
  if (!browser) return null;
  const raw = localStorage.getItem(GREETING_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedGreetingBucket;
    if (parsed && typeof parsed.date === "string" && parsed.locales && typeof parsed.locales === "object") {
      return parsed;
    }
  } catch (_error) {
    return null;
  }
  return null;
}

function readCachedGreeting(
  date: string,
  locale: Locale,
  signature: string,
): string | null {
  const bucket = readCachedBucket();
  if (!bucket || bucket.date !== date) return null;
  const cached = bucket.locales?.[locale];
  if (!cached) return null;
  if (cached.signature !== signature) return null;
  return cached.greeting;
}

function persistGreeting(
  date: string,
  locale: Locale,
  payload: CachedHeroGreeting,
): void {
  if (!browser) return;
  const existing = readCachedBucket();
  const next: CachedGreetingBucket =
    existing && existing.date === date
      ? { date, locales: { ...existing.locales } }
      : { date, locales: {} };
  next.locales[locale] = payload;
  localStorage.setItem(GREETING_CACHE_KEY, JSON.stringify(next));
}

function buildSignature(
  providerId: AiProviderId,
  prompt: string,
  temperature?: number | null,
  maxTokens?: number | null,
  timezone?: string | null,
): string {
  const configFingerprint = JSON.stringify({
    providerId,
    prompt,
    temperature: typeof temperature === "number" ? Math.round(temperature * 100) / 100 : null,
    maxTokens: maxTokens ?? null,
    timezone: timezone ?? null,
  });
  return hashString(configFingerprint);
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
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
