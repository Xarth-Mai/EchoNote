import { browser } from "$app/environment";
import type {
  DiaryEntry as EntrySummary,
  OpenAiChatRequest,
  OpenAiChatResponse,
  AiInvokePayload,
  AiModelQuery,
} from "../types";

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
      case "invoke_openai_chat":
        throw new Error("OpenAI API is unavailable during SSR");
      case "list_ai_models":
        return [] as T;
      default:
        return undefined as T;
    }
  }

  const invoke = await getInvoke();
  if (browser) {
    console.info("[EchoNote] invoke", cmd, args ?? {});
  }
  try {
    const result = await invoke<T>(cmd, args);
    if (browser) {
      console.info("[EchoNote] result", cmd, result);
    }
    return result;
  } catch (error) {
    if (browser) {
      console.error("[EchoNote] invoke failed", cmd, error);
    }
    throw error;
  }
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
  ai?: AiInvokePayload | null,
): Promise<EntrySummary> {
  return safeInvoke<EntrySummary>("save_entry_by_date", {
    date,
    body,
    ai: ai ?? null,
  });
}

export async function invokeOpenAiChat(
  request: OpenAiChatRequest,
): Promise<OpenAiChatResponse> {
  return safeInvoke<OpenAiChatResponse>("invoke_openai_chat", { request });
}

export async function listAiModels(
  request: AiModelQuery,
): Promise<string[]> {
  return safeInvoke<string[]>("list_ai_models", { request });
}
