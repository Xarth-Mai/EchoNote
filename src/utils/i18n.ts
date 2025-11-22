import { browser } from "$app/environment";
import { get, writable, type Readable } from "svelte/store";

import enTranslations from "./i18n/locales/en";
import jaTranslations from "./i18n/locales/ja";
import zhHansTranslations from "./i18n/locales/zh-Hans";
import zhHantTranslations from "./i18n/locales/zh-Hant";

export type Locale = "zh-Hans" | "zh-Hant" | "en" | "ja";

const SUPPORTED_LOCALES: Locale[] = ["zh-Hans", "zh-Hant", "en", "ja"];
const LOCALE_STORAGE_KEY = "echonote-locale";
const DEFAULT_LOCALE: Locale = "zh-Hans";

export const localeOptions: Array<{ value: Locale; label: string }> = [
  { value: "zh-Hans", label: "简体中文" },
  { value: "zh-Hant", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
];

export type TranslationKey = keyof typeof enTranslations;
type TranslationDictionary = Record<TranslationKey, string>;

const translations: Record<Locale, TranslationDictionary> = {
  en: enTranslations,
  "zh-Hans": zhHansTranslations,
  "zh-Hant": zhHantTranslations,
  ja: jaTranslations,
};

const localeStore = writable<Locale>(DEFAULT_LOCALE);
let initialized = false;

localeStore.subscribe((value) => {
  if (browser) {
    document.documentElement.lang = value;
  }
});

function normalizeLocale(value: string | null | undefined): Locale {
  if (!value) return DEFAULT_LOCALE;
  const lower = value.toLowerCase();
  const matched = SUPPORTED_LOCALES.find((item) =>
    item.toLowerCase() === lower,
  );
  if (matched) return matched;
  const prefix = SUPPORTED_LOCALES.find((item) =>
    lower.startsWith(item.toLowerCase().split("-")[0]),
  );
  return prefix ?? DEFAULT_LOCALE;
}

function detectLocale(): Locale {
  if (!browser || typeof navigator === "undefined") {
    return DEFAULT_LOCALE;
  }
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored) return normalizeLocale(stored);
  const candidates = navigator.languages ?? [navigator.language];
  for (const candidate of candidates) {
    const normalized = normalizeLocale(candidate);
    if (SUPPORTED_LOCALES.includes(normalized)) {
      return normalized;
    }
  }
  return DEFAULT_LOCALE;
}

export function initLocale(): void {
  if (initialized) return;
  initialized = true;
  const localeValue = detectLocale();
  localeStore.set(localeValue);
}

export function setLocale(value: Locale): void {
  const normalized = normalizeLocale(value);
  localeStore.set(normalized);
  if (browser) {
    localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
  }
}

export const locale: Readable<Locale> = { subscribe: localeStore.subscribe };

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const currentLocale = get(localeStore);
  const dict = translations[currentLocale] ?? translations[DEFAULT_LOCALE];
  const fallback = translations[DEFAULT_LOCALE];
  const template = (dict[key] ?? fallback[key]) as string;
  if (!params) return template;
  return Object.entries(params).reduce((acc, [paramKey, paramValue]) => {
    const pattern = new RegExp(`{${paramKey}}`, "g");
    return acc.replace(pattern, String(paramValue));
  }, template);
}

export function formatFullDate(date: Date, localeOverride?: Locale): string {
  const targetLocale = localeOverride ?? get(localeStore);
  return new Intl.DateTimeFormat(targetLocale, {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

export function formatMonthDay(date: Date, localeOverride?: Locale): string {
  const targetLocale = localeOverride ?? get(localeStore);
  return new Intl.DateTimeFormat(targetLocale, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatMonthTitle(
  year: number,
  month: number,
  localeOverride?: Locale,
): string {
  const targetLocale = localeOverride ?? get(localeStore);
  const date = new Date(Date.UTC(year, month, 1));
  return new Intl.DateTimeFormat(targetLocale, {
    year: "numeric",
    month: "long",
  }).format(date);
}

export function formatLongDate(
  dateValue: string,
  localeOverride?: Locale,
): { display: string; weekday: string } {
  if (!dateValue) return { display: t("editorNoDate"), weekday: "" };
  const targetLocale = localeOverride ?? get(localeStore);
  const date = new Date(dateValue);
  const formatter = new Intl.DateTimeFormat(targetLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const weekdayFormatter = new Intl.DateTimeFormat(targetLocale, {
    weekday: "short",
  });
  return {
    display: formatter.format(date),
    weekday: weekdayFormatter.format(date),
  };
}

const MONDAY_ANCHOR = Date.UTC(2024, 0, 1); // Monday
const SUNDAY_ANCHOR = Date.UTC(2023, 11, 31); // Sunday

export function getWeekdayLabels(
  localeOverride?: Locale,
  options: { weekStartsOnMonday?: boolean; variant?: "short" | "narrow" } = {},
): string[] {
  const { weekStartsOnMonday = true, variant = "short" } = options;
  const targetLocale = localeOverride ?? get(localeStore);
  const formatter = new Intl.DateTimeFormat(targetLocale, {
    weekday: variant,
    timeZone: "UTC",
  });
  const start = weekStartsOnMonday ? MONDAY_ANCHOR : SUNDAY_ANCHOR;
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(start + index * 86_400_000)),
  );
}
