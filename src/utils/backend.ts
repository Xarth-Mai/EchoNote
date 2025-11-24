import { browser } from "$app/environment";
import type {
  DiaryEntry as EntrySummary,
  AiChatRequest,
  AiChatResult,
  AiInvokePayload,
  AiModelQuery,
} from "../types";

type Invoke = typeof import("@tauri-apps/api/core").invoke;

let invokeFn: Invoke | null = null;

async function getInvoke(): Promise<Invoke> {
  // 按需加载 Tauri invoke，避免在非浏览器上下文直接引用导致异常
  if (!browser) {
    throw new Error("Tauri invoke is unavailable outside the browser");
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
  console.log(`[EchoNote] Invoking backend command: ${cmd}`, { args });

  // 非 Tauri 环境下返回可控的降级结果，避免因调用失败导致崩溃
  if (!browser) {
    console.warn(
      `[EchoNote] Attempted to call "${cmd}" outside the browser; returning fallback result.`,
    );
    // ... (rest of the fallback logic remains the same)
  }

  const invoke = await getInvoke();
  try {
    const result = await invoke<T>(cmd, args);
    console.log(`[EchoNote] Command "${cmd}" succeeded`, { result });
    return result;
  } catch (error) {
    console.error(`[EchoNote] Command "${cmd}" failed`, { error });
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

export async function invokeAiChat(
  request: AiChatRequest,
): Promise<AiChatResult> {
  return safeInvoke<AiChatResult>("invoke_ai_chat", { request });
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
