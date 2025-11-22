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
  `Provide the summary exactly according to the system rules.`;

export const DEFAULT_TEMPERATURE = 1;
export const DEFAULT_GREETING_PROMPT =
  "Please craft a short, warm hero greeting for today's diary. Keep it optimistic, personal, and add an emoji.";
const DEFAULT_MAX_TOKENS = 60;

const BUILTIN_PROVIDERS: Record<
  "chatgpt" | "deepseek" | "gemini" | "claude" | "noai",
  Pick<AiProviderConfig, "id" | "label" | "baseUrl">
> = {
  noai: {
    id: "noai",
    label: "No AI",
    baseUrl: "",
  },
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    baseUrl: "https://api.openai.com/v1",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
  },
  claude: {
    id: "claude",
    label: "Claude",
    baseUrl: "https://api.anthropic.com",
  },
};

const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  noai: "",
  chatgpt: "gpt-5-mini",
  deepseek: "deepseek-chat",
  gemini: "gemini-flash-lite-latest",
  claude: "claude-haiku-4.5",
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
    greetingPrompt: advanced.greetingPrompt,
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
    maxTokens: getDefaultMaxTokens(),
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
      prompt: normalizePrompt(existing?.prompt),
      maxTokens: normalizeMaxTokens(existing?.maxTokens),
      temperature: normalizeTemperature(existing?.temperature),
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
        maxTokens: normalizeMaxTokens(cfg.maxTokens),
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

  const advanced = sanitizeAdvancedSettings(base.advanced);
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
        prompt: DEFAULT_AI_PROMPT,
        maxTokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        type: "builtin",
      },
      chatgpt: {
        id: "chatgpt",
        label: BUILTIN_PROVIDERS.chatgpt.label,
        baseUrl: BUILTIN_PROVIDERS.chatgpt.baseUrl,
        editable: false,
        model: DEFAULT_MODEL_BY_PROVIDER.chatgpt,
        prompt: DEFAULT_AI_PROMPT,
        maxTokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        type: "builtin",
      },
      deepseek: {
        id: "deepseek",
        label: BUILTIN_PROVIDERS.deepseek.label,
        baseUrl: BUILTIN_PROVIDERS.deepseek.baseUrl,
        editable: false,
        model: DEFAULT_MODEL_BY_PROVIDER.deepseek,
        prompt: DEFAULT_AI_PROMPT,
        maxTokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        type: "builtin",
      },
      gemini: {
        id: "gemini",
        label: BUILTIN_PROVIDERS.gemini.label,
        baseUrl: BUILTIN_PROVIDERS.gemini.baseUrl,
        editable: false,
        model: DEFAULT_MODEL_BY_PROVIDER.gemini,
        prompt: DEFAULT_AI_PROMPT,
        maxTokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        type: "builtin",
      },
      claude: {
        id: "claude",
        label: BUILTIN_PROVIDERS.claude.label,
        baseUrl: BUILTIN_PROVIDERS.claude.baseUrl,
        editable: false,
        model: DEFAULT_MODEL_BY_PROVIDER.claude,
        prompt: DEFAULT_AI_PROMPT,
        maxTokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        type: "builtin",
      },
    },
    advanced: {
      prompt: DEFAULT_AI_PROMPT,
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: getDefaultMaxTokens(),
      greetingPrompt: DEFAULT_GREETING_PROMPT,
    },
    apiKeyHints: {},
  };
}

export function getDefaultMaxTokens(): number {
  return DEFAULT_MAX_TOKENS;
}

function normalizePrompt(value?: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_AI_PROMPT;
}

function normalizeMaxTokens(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return getDefaultMaxTokens();
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
  input?: AiAdvancedSettings,
): AiAdvancedSettings {
  const prompt = normalizePrompt(input?.prompt);
  const temperature = normalizeTemperature(input?.temperature);
  const maxTokens = normalizeMaxTokens(input?.maxTokens);
  const greetingPrompt = normalizeGreetingPrompt(input?.greetingPrompt);

  return { prompt, temperature, maxTokens, greetingPrompt };
}

function normalizeGreetingPrompt(value?: string): string {
  const trimmed = value?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }
  return DEFAULT_GREETING_PROMPT;
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
