import { browser } from "$app/environment";
import type {
  AiInvokePayload,
  AiProviderConfig,
  AiProviderId,
  AiSettingsState,
} from "../types";

const STORAGE_KEY = "echonote-ai-settings";
export const DEFAULT_AI_PROMPT =
  "You are an assistant that summarizes diary entries in concise Chinese, optionally referencing emotions if present.";

export const DEFAULT_TEMPERATURE = 0.3;

const BUILTIN_PROVIDERS: Record<
  "chatgpt" | "deepseek",
  Pick<
    AiProviderConfig,
    "id" | "label" | "baseUrl" | "prompt" | "maxTokens" | "temperature"
  >
> = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    baseUrl: "https://api.openai.com/v1",
    prompt: DEFAULT_AI_PROMPT,
    maxTokens: 60,
    temperature: DEFAULT_TEMPERATURE,
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    prompt: DEFAULT_AI_PROMPT,
    maxTokens: 2048,
    temperature: DEFAULT_TEMPERATURE,
  },
};

const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  chatgpt: "gpt-4o-mini",
  deepseek: "deepseek-chat",
};

export function loadAiSettingsState(): AiSettingsState {
  const fallback = createDefaultState();
  if (!browser) return fallback;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as AiSettingsState;
    return sanitizeState(parsed);
  } catch (_error) {
    return fallback;
  }
}

export function saveAiSettingsState(state: AiSettingsState): void {
  if (!browser) return;
  const sanitized = sanitizeState(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
}

export function getActiveAiInvokePayload(
  state?: AiSettingsState,
): AiInvokePayload | null {
  const snapshot = sanitizeState(state ?? loadAiSettingsState());
  const provider = snapshot.providers[snapshot.activeProviderId];
  if (!provider || !provider.apiKey || provider.apiKey.trim() === "") {
    return null;
  }
  return {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey.trim(),
    model: provider.model ?? null,
    prompt: normalizePrompt(provider.prompt),
    maxTokens: normalizeMaxTokens(provider.maxTokens, provider.id),
    temperature: normalizeTemperature(provider.temperature),
  };
}

export function createCustomProviderConfig(
  suffix: string,
  baseUrl: string,
): AiProviderConfig {
  const normalizedSuffix = suffix.trim();
  const id = `openai-custom-${normalizedSuffix}` as AiProviderId;
  const label = `OpenAI API Custom · ${normalizedSuffix || "default"}`;
  return {
    id,
    label,
    baseUrl: baseUrl.trim() || BUILTIN_PROVIDERS.chatgpt.baseUrl,
    editable: true,
    apiKey: "",
    model: DEFAULT_MODEL_BY_PROVIDER.chatgpt,
    prompt: DEFAULT_AI_PROMPT,
    maxTokens: getDefaultMaxTokens("chatgpt"),
    temperature: DEFAULT_TEMPERATURE,
    type: "custom",
    suffix: normalizedSuffix || "default",
  };
}

export function sanitizeState(input?: AiSettingsState): AiSettingsState {
  const base = input ?? createDefaultState();
  const providers: Partial<Record<AiProviderId, AiProviderConfig>> = {};

  for (const [key, built] of Object.entries(BUILTIN_PROVIDERS)) {
    const id = built.id as AiProviderId;
    const existing = base.providers[id];
    providers[id] = {
      id,
      label: built.label,
      baseUrl: built.baseUrl,
      editable: false,
      apiKey: existing?.apiKey ?? "",
      model:
        existing?.model ??
        DEFAULT_MODEL_BY_PROVIDER[key] ??
        DEFAULT_MODEL_BY_PROVIDER.chatgpt,
      prompt: normalizePrompt(existing?.prompt ?? built.prompt),
      maxTokens: normalizeMaxTokens(existing?.maxTokens, id),
      temperature: normalizeTemperature(existing?.temperature ?? built.temperature),
      type: "builtin",
    };
  }

  Object.values(base.providers)
    .filter((cfg) => cfg.type === "custom")
    .forEach((cfg) => {
      if (!cfg.id.startsWith("openai-custom-")) {
        return;
      }
      let target_id = cfg.id as AiProviderId;
      providers[target_id] = {
        ...cfg,
        editable: true,
        baseUrl: cfg.baseUrl.trim() || BUILTIN_PROVIDERS.chatgpt.baseUrl,
        apiKey: cfg.apiKey ?? "",
        model: cfg.model ?? DEFAULT_MODEL_BY_PROVIDER.chatgpt,
        prompt: normalizePrompt(cfg.prompt),
        maxTokens: normalizeMaxTokens(cfg.maxTokens, target_id),
        temperature: normalizeTemperature(cfg.temperature),
        type: "custom",
        suffix: cfg.suffix ?? cfg.id.replace("openai-custom-", ""),
        label:
          cfg.label ||
          `OpenAI API Custom · ${cfg.suffix ?? cfg.id.replace("openai-custom-", "")}`,
      };
    });

  const active = providers[base.activeProviderId]
    ? base.activeProviderId
    : ("chatgpt" as AiProviderId);

  return {
    activeProviderId: active,
    providers: providers as Record<AiProviderId, AiProviderConfig>,
  };
}

export function createDefaultState(): AiSettingsState {
  return {
    activeProviderId: "chatgpt",
    providers: {
      chatgpt: {
        id: "chatgpt",
        label: BUILTIN_PROVIDERS.chatgpt.label,
        baseUrl: BUILTIN_PROVIDERS.chatgpt.baseUrl,
        editable: false,
        apiKey: "",
        model: DEFAULT_MODEL_BY_PROVIDER.chatgpt,
        prompt: BUILTIN_PROVIDERS.chatgpt.prompt,
        maxTokens: BUILTIN_PROVIDERS.chatgpt.maxTokens,
        temperature: BUILTIN_PROVIDERS.chatgpt.temperature,
        type: "builtin",
      },
      deepseek: {
        id: "deepseek",
        label: BUILTIN_PROVIDERS.deepseek.label,
        baseUrl: BUILTIN_PROVIDERS.deepseek.baseUrl,
        editable: false,
        apiKey: "",
        model: DEFAULT_MODEL_BY_PROVIDER.deepseek,
        prompt: BUILTIN_PROVIDERS.deepseek.prompt,
        maxTokens: BUILTIN_PROVIDERS.deepseek.maxTokens,
        temperature: BUILTIN_PROVIDERS.deepseek.temperature,
        type: "builtin",
      },
    },
  };
}

export function getDefaultMaxTokens(providerId?: AiProviderId): number {
  if (providerId === "deepseek") {
    return BUILTIN_PROVIDERS.deepseek.maxTokens ?? 2048;
  }
  return BUILTIN_PROVIDERS.chatgpt.maxTokens ?? 60;
}

function normalizePrompt(value?: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_AI_PROMPT;
}

function normalizeMaxTokens(
  value?: number,
  providerId?: AiProviderId,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return getDefaultMaxTokens(providerId);
  }
  return Math.floor(value);
}

function normalizeTemperature(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_TEMPERATURE;
  }
  const clamped = Math.max(0, Math.min(value, 2));
  return Math.round(clamped * 100) / 100;
}
