import { browser } from "$app/environment";
import type {
  AiInvokePayload,
  AiProviderConfig,
  AiProviderId,
  AiSettingsState,
} from "../types";

const STORAGE_KEY = "echonote-ai-settings";
export const DEFAULT_AI_PROMPT =
  "格式`$emoji: summary`；emoji贴合情绪/主题；语言与风格完全跟随正文作者；不得虚构内容；保持视角一致；仅精炼压缩正文。";

export const DEFAULT_TEMPERATURE = 0.3;

const BUILTIN_PROVIDERS: Record<
  "chatgpt" | "deepseek" | "noai",
  Pick<
    AiProviderConfig,
    "id" | "label" | "baseUrl" | "prompt" | "maxTokens" | "temperature"
  >
> = {
  noai: {
    id: "noai",
    label: "不使用 AI",
    baseUrl: "",
    prompt: DEFAULT_AI_PROMPT,
    maxTokens: 0,
    temperature: DEFAULT_TEMPERATURE,
  },
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
    maxTokens: 60,
    temperature: DEFAULT_TEMPERATURE,
  },
};

const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  noai: "",
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

export async function getActiveAiInvokePayload(
  state?: AiSettingsState,
): Promise<AiInvokePayload | null> {
  if (!browser) return null;
  const snapshot = sanitizeState(state ?? loadAiSettingsState());
  const providerId = snapshot.activeProviderId ?? "noai";
  const provider = snapshot.providers[providerId];
  if (!provider) {
    return { providerId: "noai" };
  }

  return {
    providerId,
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
    .filter((cfg): cfg is AiProviderConfig => Boolean(cfg && cfg.type === "custom"))
    .forEach((cfg) => {
      if (!cfg || !cfg.id.startsWith("openai-custom-")) {
        return;
      }
      const target_id = cfg.id as AiProviderId;
      providers[target_id] = {
        ...cfg,
        editable: true,
        baseUrl: cfg.baseUrl.trim() || BUILTIN_PROVIDERS.chatgpt.baseUrl,
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

  const active =
    base.activeProviderId === "noai"
      ? "noai"
      : providers[base.activeProviderId]
        ? base.activeProviderId
        : ("chatgpt" as AiProviderId);

  return {
    activeProviderId: active,
    providers: providers as Record<AiProviderId, AiProviderConfig>,
  };
}

export function createDefaultState(): AiSettingsState {
  return {
    activeProviderId: "noai",
    providers: {
      noai: {
        id: "noai",
        label: BUILTIN_PROVIDERS.noai.label,
        baseUrl: BUILTIN_PROVIDERS.noai.baseUrl,
        editable: false,
        model: DEFAULT_MODEL_BY_PROVIDER.noai,
        prompt: BUILTIN_PROVIDERS.noai.prompt,
        maxTokens: BUILTIN_PROVIDERS.noai.maxTokens,
        temperature: BUILTIN_PROVIDERS.noai.temperature,
        type: "builtin",
      },
      chatgpt: {
        id: "chatgpt",
        label: BUILTIN_PROVIDERS.chatgpt.label,
        baseUrl: BUILTIN_PROVIDERS.chatgpt.baseUrl,
        editable: false,
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
  if (providerId === "noai") {
    return 0;
  }
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
