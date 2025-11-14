import { browser } from "$app/environment";
import type { DiaryEntry as EntrySummary } from "../types";

type Invoke = typeof import("@tauri-apps/api/core").invoke;

let invokeFn: Invoke | null = null;

async function getInvoke(): Promise<Invoke> {
  if (!browser) {
    throw new Error("Tauri invoke is unavailable during SSR");
  }

  if (!invokeFn) {
    const mod = await import("@tauri-apps/api/core");
    invokeFn = mod.invoke;
  }

  return invokeFn;
}

async function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!browser) {
    console.warn(
      `[EchoNote] Attempted to call "${cmd}" during SSR; returning fallback result.`,
    );
    switch (cmd) {
      case "list_entries_by_month":
        return [] as T;
      case "get_entry_body_by_date":
        return null as T;
      default:
        return undefined as T;
    }
  }

  const invoke = await getInvoke();
  return invoke<T>(cmd, args);
}

export async function listEntriesByMonth(
  year: number,
  month: number,
): Promise<EntrySummary[]> {
  return safeInvoke<EntrySummary[]>("list_entries_by_month", { year, month });
}

export async function getEntryBody(date: string): Promise<string | null> {
  return safeInvoke<string | null>("get_entry_body_by_date", { date });
}

export async function saveEntryByDate(
  date: string,
  body: string,
): Promise<EntrySummary> {
  return safeInvoke<EntrySummary>("save_entry_by_date", { date, body });
}
