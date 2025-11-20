import { browser } from "$app/environment";
import type {
  AiAdvancedSettings,
  AiInvokePayload,
  AiProviderConfig,
  AiProviderId,
  AiSettingsState,
} from "../types";

const STORAGE_KEY = "echonote-ai-settings";
export const DEFAULT_AI_PROMPT =
  `Provide the summary exactly according to the system rules. You may adjust tone, focus, or preference here if needed.`;

export const DEFAULT_TEMPERATURE = 0.3;

const BUILTIN_PROVIDERS: Record<
  "chatgpt" | "deepseek" | "gemini" | "claude" | "noai",
  Pick<
    AiProviderConfig,
    "id" | "label" | "baseUrl" | "prompt" | "maxTokens" | "temperature"
  >
> = {
  noai: {
    id: "noai",
    label: "No AI",
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
  gemini: {
    id: "gemini",
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    prompt: DEFAULT_AI_PROMPT,
    maxTokens: 1200,
    temperature: DEFAULT_TEMPERATURE,
  },
  claude: {
    id: "claude",
    label: "Claude",
    baseUrl: "https://api.anthropic.com",
    prompt: DEFAULT_AI_PROMPT,
    maxTokens: 1200,
    temperature: DEFAULT_TEMPERATURE,
  },
};

const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  noai: "",
  chatgpt: "gpt-4o-mini",
  deepseek: "deepseek-chat",
  gemini: "gemini-1.5-flash-latest",
  claude: "claude-3-5-haiku-20241022",
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

  const advanced = snapshot.advanced;
  return {
    providerId,
    prompt: advanced.prompt,
    maxTokens: advanced.maxTokens,
    temperature: advanced.temperature,
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

  const advanced = sanitizeAdvancedSettings(
    base.advanced,
    providers[active],
    active,
  );
  const apiKeyHints = sanitizeApiKeyHints(base.apiKeyHints, providers);

  for (const cfg of Object.values(providers)) {
    if (!cfg) continue;
    cfg.prompt = advanced.prompt;
    cfg.temperature = advanced.temperature;
    cfg.maxTokens = advanced.maxTokens;
  }

  return {
    activeProviderId: active,
    providers: providers as Record<AiProviderId, AiProviderConfig>,
    advanced,
    apiKeyHints,
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
      gemini: {
        id: "gemini",
        label: BUILTIN_PROVIDERS.gemini.label,
        baseUrl: BUILTIN_PROVIDERS.gemini.baseUrl,
        editable: false,
        model: DEFAULT_MODEL_BY_PROVIDER.gemini,
        prompt: BUILTIN_PROVIDERS.gemini.prompt,
        maxTokens: BUILTIN_PROVIDERS.gemini.maxTokens,
        temperature: BUILTIN_PROVIDERS.gemini.temperature,
        type: "builtin",
      },
      claude: {
        id: "claude",
        label: BUILTIN_PROVIDERS.claude.label,
        baseUrl: BUILTIN_PROVIDERS.claude.baseUrl,
        editable: false,
        model: DEFAULT_MODEL_BY_PROVIDER.claude,
        prompt: BUILTIN_PROVIDERS.claude.prompt,
        maxTokens: BUILTIN_PROVIDERS.claude.maxTokens,
        temperature: BUILTIN_PROVIDERS.claude.temperature,
        type: "builtin",
      },
    },
    advanced: {
      prompt: DEFAULT_AI_PROMPT,
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: getDefaultMaxTokens("chatgpt"),
    },
    apiKeyHints: {},
  };
}

export function getDefaultMaxTokens(providerId?: AiProviderId): number {
  if (providerId === "noai") {
    return 0;
  }
  if (providerId === "deepseek") {
    return BUILTIN_PROVIDERS.deepseek.maxTokens ?? 2048;
  }
  if (providerId === "gemini") {
    return BUILTIN_PROVIDERS.gemini.maxTokens ?? 1024;
  }
  if (providerId === "claude") {
    return BUILTIN_PROVIDERS.claude.maxTokens ?? 1024;
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

function sanitizeAdvancedSettings(
  input: AiAdvancedSettings | undefined,
  fallback?: AiProviderConfig,
  providerId?: AiProviderId,
): AiAdvancedSettings {
  const prompt = normalizePrompt(input?.prompt ?? fallback?.prompt);
  const temperature = normalizeTemperature(
    input?.temperature ?? fallback?.temperature,
  );
  const maxTokens = normalizeMaxTokens(
    input?.maxTokens ?? fallback?.maxTokens,
    providerId ?? fallback?.id,
  );

  return { prompt, temperature, maxTokens };
}

function sanitizeApiKeyHints(
  input: Partial<Record<AiProviderId, string>> | undefined,
  providers: Partial<Record<AiProviderId, AiProviderConfig>>,
): Partial<Record<AiProviderId, string>> {
  if (!input) return {};
  const hints: Partial<Record<AiProviderId, string>> = {};
  for (const [key, value] of Object.entries(input)) {
    const providerId = key as AiProviderId;
    if (!providers[providerId]) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    hints[providerId] = trimmed;
  }
  return hints;
}
