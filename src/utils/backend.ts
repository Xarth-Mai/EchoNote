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
  // 按需加载 Tauri invoke，避免 SSR 阶段直接引用导致异常
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
  // SSR 或非 Tauri 环境下返回可控的降级结果，避免因调用失败导致崩溃
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
      case "load_cached_models":
        return [] as T;
      case "load_provider_base_url":
        return null as T;
      case "store_provider_base_url":
      case "delete_provider_slot":
      case "store_api_secret":
      case "delete_api_secret":
        return undefined as T;
      default:
        return undefined as T;
    }
  }

  const invoke = await getInvoke();
  try {
    const result = await invoke<T>(cmd, args);
    return result;
  } catch (error) {
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

export async function loadProviderModelCache(
  providerId: string,
): Promise<string[] | null> {
  return safeInvoke<string[] | null>("load_cached_models", { providerId });
}

export async function loadProviderBaseUrl(
  providerId: string,
): Promise<string | null> {
  return safeInvoke<string | null>("load_provider_base_url", { providerId });
}

export async function storeProviderBaseUrl(
  providerId: string,
  baseUrl: string,
): Promise<void> {
  await safeInvoke<void>("store_provider_base_url", { providerId, baseUrl });
}

export async function storeProviderModel(
  providerId: string,
  model: string,
): Promise<void> {
  await safeInvoke<void>("store_provider_model", { providerId, model });
}

export async function loadProviderModel(
  providerId: string,
): Promise<string | null> {
  return safeInvoke<string | null>("load_provider_model", { providerId });
}
export async function storeProviderApiKey(
  providerId: string,
  apiKey: string,
): Promise<void> {
  await safeInvoke<void>("store_api_secret", { providerId, apiKey });
}

export async function deleteProviderApiKey(
  providerId: string,
): Promise<void> {
  await safeInvoke<void>("delete_api_secret", { providerId });
}

export async function deleteProviderSlot(providerId: string): Promise<void> {
  await safeInvoke<void>("delete_provider_slot", { providerId });
}
