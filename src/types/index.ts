// EchoNote 类型定义

/** 日记条目 */
export interface DiaryEntry {
  date: string; // YYYY-MM-DD
  emoji?: string; // 每日 Emoji
  aiSummary?: string; // AI 生成的摘要
  language?: string; // 创作语言
}

/** 应用状态 */
export interface AppState {
  currentDate: string; // 当前选中的日期
  currentBody: string | null; // 当前条目的正文缓存
  summaries: Map<string, DiaryEntry>; // 缓存的所有日记条目，key 为日期
  layoutMode: "portrait" | "landscape"; // 布局模式
  calendarExpanded: boolean; // 日历是否展开
  theme: "light" | "dark" | "auto"; // 主题模式：light=浅色，dark=深色，auto=跟随系统
}

export interface AiMessage {
  role: string;
  content: string;
}

export interface AiChatRequest {
  providerId: AiProviderId;
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AiChatResult {
  content: string;
  finishReason?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export type BuiltinAiProvider = "chatgpt" | "deepseek" | "gemini" | "claude";
export type CustomAiProvider = `openai-custom-${string}`;
export type AiProviderId = BuiltinAiProvider | CustomAiProvider | "noai";

export interface AiProviderConfig {
  id: AiProviderId;
  label: string;
  baseUrl: string;
  editable: boolean;
  model?: string;
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
  type: "builtin" | "custom";
  suffix?: string;
}

export interface AiAdvancedSettings {
  prompt: string;
  temperature: number;
  maxTokens: number;
}

export interface AiSettingsState {
  activeProviderId: AiProviderId;
  providers: Partial<Record<AiProviderId, AiProviderConfig>>;
  advanced: AiAdvancedSettings;
  apiKeyHints: Partial<Record<AiProviderId, string>>;
}

export interface AiInvokePayload {
  providerId?: string | null;
  prompt?: string | null;
  maxTokens?: number | null;
  temperature?: number | null;
}

export interface AiModelQuery {
  baseUrl: string;
  providerId: string;
}
