import { browser } from "$app/environment";
import { get, writable, type Readable } from "svelte/store";

export type Locale = "zh-CN" | "zh-TW" | "en" | "ja";

const SUPPORTED_LOCALES: Locale[] = ["zh-CN", "zh-TW", "en", "ja"];
const LOCALE_STORAGE_KEY = "echonote-locale";
const DEFAULT_LOCALE: Locale = "zh-CN";

export const localeOptions: Array<{ value: Locale; label: string }> = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
];

const enTranslations = {
    appName: "EchoNote",
    providerNoAi: "No AI",
    providerChatgpt: "ChatGPT",
    providerDeepseek: "DeepSeek",
    greetingDawn: "Good early morning",
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    homeSubline: "{greeting}! Today is {date}",
    homeTitle: "Capture your inspirations and emotional rhythm",
    homeTodayCta: "Today",
    homeEditCta: "Edit",
    homeEditCtaWithDate: "Edit {date}",
    homeSettings: "Settings",
    calendarPrevMonth: "Previous month",
    calendarNextMonth: "Next month",
    calendarCollapse: "Collapse calendar",
    calendarExpand: "Expand calendar",
    timelineEmpty: "No diary entries yet",
    timelinePlaceholderTitle: "No entry for this day",
    timelinePlaceholderHint: "Use the top button to start writing",
    timelineEmojiLabel: "Daily emoji",
    timelineAiPending: "AI summary in progress...",
    editorHeadTitle: "Editor",
    editorBackHome: "Back to home",
    editorComplete: "Done",
    editorNoDate: "No date selected",
    editorPlaceholder: "Capture your ideas, moments, and reflections...",
    settingsHeadTitle: "Settings",
    settingsCaption: "Settings",
    settingsBack: "Back",
    settingsLanguageTitle: "Interface language",
    settingsLanguageDescription: "Switch the app interface language.",
    settingsThemeTitle: "Theme mode",
    settingsThemeDescription:
      "Choose a look that matches your system or personal preference.",
    settingsThemeFollow: "Follow system",
    settingsThemeLight: "Light",
    settingsThemeDark: "Dark",
    settingsAiTitle: "AI service",
    settingsAiDescription:
      "Pick a provider, configure credentials, and set a default model.",
    settingsApiType: "API type",
    settingsFixedBaseUrl: "This provider uses a fixed Base URL",
    settingsBaseUrlExample: "Example: https://api.openai.com/v1",
    settingsApiKeyHint:
      "Keys are encrypted on the backend and never echoed in the UI. Leave empty to reuse the saved key.",
    settingsDefaultModel: "Default model",
    settingsFetchModelsPlaceholder: "Fetch the model list first",
    settingsRefreshModels: "Refresh models",
    settingsRefreshingModels: "Fetching...",
    settingsModelTip: "Chat models such as gpt-5.1-mini are recommended.",
    settingsAdvancedTitle: "Advanced settings",
    settingsToggleAdvancedShow: "Show advanced settings",
    settingsToggleAdvancedHide: "Hide advanced settings",
    settingsCustomPrompt: "Custom prompt",
    settingsPromptTip:
      "Reasoning models are usually slow; the default prompt often suffices.",
    settingsTemperature: "Temperature (0-1)",
    settingsTemperaturePlaceholder: "e.g. 0.3",
    settingsTemperatureTip:
      "Suggested: ~0.3 for chat models. Higher values generate more variety.",
    settingsMaxTokens: "Max output tokens",
    settingsMaxTokensPlaceholder: "e.g. 60 or 2048",
    settingsMaxTokensTip:
      "Suggestion: ~60 for chat models; ~2048 for reasoning when necessary.",
    settingsAiDisabledNote:
      "AI is disabled. Choose another provider above to enable it.",
    settingsSaveAdvanced: "Save advanced settings",
    settingsResetAdvanced: "Reset to defaults and save",
    settingsDeleteCustom: "Delete this custom provider",
    settingsAddCustomTitle: "Add OpenAI API Custom",
    settingsCustomSuffix: "Custom name suffix",
    settingsCustomSuffixPlaceholder: "e.g. team-a",
    settingsAddCustom: "Add custom provider",
    statusUnsavedChanges: "You have unsaved changes",
    statusAiDisabled: "AI is currently disabled",
    statusNoModels: "No available models returned",
    statusModelsFetched: "{count} models detected",
    statusFetchModelsFailed: "Unable to fetch models; please check the config",
    statusSuffixRequired: "Please enter a custom suffix",
    statusSuffixDuplicate: "That suffix already exists; pick another",
    statusCustomAdded: "Custom provider added",
    statusDeleteCustomOnly: "Only custom providers can be deleted",
    statusDeleteSecretFailed: "Failed to delete the stored key",
    statusCustomDeleted: "Custom provider deleted",
    statusResetAdvanced: "Advanced settings restored to defaults",
    statusApiKeyInvalid: "Please enter a valid API key",
    statusAiOff: "AI is turned off",
    statusAiOffFailed: "Failed to turn off AI; please retry",
    statusModelRequired: "Please select a model type",
    statusBaseInvalid: "Invalid Base URL",
    statusBaseRisk: "Potential risk detected ({warnings}); click again to confirm",
    statusBasicSaved: "Basic settings saved",
    statusBasicSaveFailed: "Failed to save basic settings",
    statusAdvancedSaved: "Advanced settings saved",
    statusAdvancedSaveFailed: "Failed to save advanced settings",
    statusAdvancedSaveBlocked: "AI is currently disabled",
    statusBaseNonHttps: "Using non-HTTPS protocol",
    statusBaseLocalhost: "Points to localhost",
    statusBasePrivate: "Points to a private network or loopback address",
    baseUrlFormatError: "Invalid Base URL format",
    saving: "Saving...",
    saveBasic: "Save basic settings",
    confirmRiskAndSave: "Confirm risk and save",
} as const;

export type TranslationKey = keyof typeof enTranslations;
type TranslationDictionary = Record<TranslationKey, string>;

const translations: Record<Locale, TranslationDictionary> = {
  en: enTranslations,
  "zh-CN": {
    appName: "EchoNote",
    providerNoAi: "不使用 AI",
    providerChatgpt: "ChatGPT",
    providerDeepseek: "DeepSeek",
    greetingDawn: "凌晨好",
    greetingMorning: "早安",
    greetingAfternoon: "下午好",
    greetingEvening: "晚上好",
    homeSubline: "{greeting}! 今天是 {date}",
    homeTitle: "记下你的灵感与情绪节奏",
    homeTodayCta: "今日记录",
    homeEditCta: "去编辑",
    homeEditCtaWithDate: "{date} · 去编辑",
    homeSettings: "设置中心",
    calendarPrevMonth: "上一月",
    calendarNextMonth: "下一月",
    calendarCollapse: "收起月历",
    calendarExpand: "展开月历",
    timelineEmpty: "暂无日记",
    timelinePlaceholderTitle: "当日暂无内容",
    timelinePlaceholderHint: "点击顶部按钮开始记录",
    timelineEmojiLabel: "每日 Emoji",
    timelineAiPending: "AI 摘要生成中...",
    editorHeadTitle: "编辑器",
    editorBackHome: "返回主页",
    editorComplete: "完成",
    editorNoDate: "未选择日期",
    editorPlaceholder: "记录你的灵感、片刻与感悟...",
    settingsHeadTitle: "设置",
    settingsCaption: "设置中心",
    settingsBack: "返回",
    settingsLanguageTitle: "界面语言",
    settingsLanguageDescription: "切换应用界面的显示语言。",
    settingsThemeTitle: "主题模式",
    settingsThemeDescription: "选择与系统或个人偏好一致的外观。",
    settingsThemeFollow: "跟随系统",
    settingsThemeLight: "浅色",
    settingsThemeDark: "深色",
    settingsAiTitle: "AI 服务",
    settingsAiDescription: "选择提供商、配置凭据并设置默认模型。",
    settingsApiType: "API 类型",
    settingsFixedBaseUrl: "该提供商使用固定 Base URL",
    settingsBaseUrlExample: "例如 https://api.openai.com/v1",
    settingsApiKeyHint:
      "保存后密钥将加密存储于后端，不会在前端回显。若未填写则复用已保存的密钥。",
    settingsDefaultModel: "默认模型",
    settingsFetchModelsPlaceholder: "请先获取模型列表",
    settingsRefreshModels: "刷新模型",
    settingsRefreshingModels: "拉取中...",
    settingsModelTip: "推荐使用 Chat 模型，如 gpt-5.1-mini",
    settingsAdvancedTitle: "高级设置",
    settingsToggleAdvancedShow: "显示高级设置",
    settingsToggleAdvancedHide: "隐藏高级设置",
    settingsCustomPrompt: "自定义 Prompt",
    settingsPromptTip: "推理模型通常耗时高且价值有限，可沿用该提示词。",
    settingsTemperature: "温度（0-1）",
    settingsTemperaturePlaceholder: "例如 0.3",
    settingsTemperatureTip: "推荐值：Chat 模型约 0.3。温度越高越发散。",
    settingsMaxTokens: "最大输出 Tokens",
    settingsMaxTokensPlaceholder: "例如 60 或 2048",
    settingsMaxTokensTip:
      "建议：Chat 模型约 60；推理模型约 2048（但多数场景并不值得启用推理模型）。",
    settingsAiDisabledNote: "当前已关闭 AI，若需开启请在上方选择其他提供商。",
    settingsSaveAdvanced: "保存高级设置",
    settingsResetAdvanced: "恢复高级设置默认值并保存",
    settingsDeleteCustom: "删除当前自定义接口",
    settingsAddCustomTitle: "新增 OpenAI API Custom",
    settingsCustomSuffix: "自定义名称后缀",
    settingsCustomSuffixPlaceholder: "例如 team-a",
    settingsAddCustom: "添加自定义接口",
    statusUnsavedChanges: "存在未保存的更改",
    statusAiDisabled: "当前已关闭 AI",
    statusNoModels: "未返回可用模型",
    statusModelsFetched: "已识别 {count} 个模型",
    statusFetchModelsFailed: "无法获取模型，请检查配置",
    statusSuffixRequired: "请填写自定义名称后缀",
    statusSuffixDuplicate: "该后缀已存在，请更换",
    statusCustomAdded: "已添加自定义接口",
    statusDeleteCustomOnly: "仅可删除自定义接口",
    statusDeleteSecretFailed: "删除自定义密钥失败",
    statusCustomDeleted: "已删除自定义接口",
    statusResetAdvanced: "已恢复高级设置默认值",
    statusApiKeyInvalid: "请输入有效 API Key",
    statusAiOff: "已关闭 AI",
    statusAiOffFailed: "关闭失败，请重试",
    statusModelRequired: "请选择模型类型",
    statusBaseInvalid: "Base URL 无效",
    statusBaseRisk: "检测到潜在风险（{warnings}），请再次点击按钮确认保存",
    statusBasicSaved: "基础配置已保存",
    statusBasicSaveFailed: "保存基础配置失败",
    statusAdvancedSaved: "高级设置已保存",
    statusAdvancedSaveFailed: "保存高级设置失败",
    statusAdvancedSaveBlocked: "当前已关闭 AI",
    statusBaseNonHttps: "使用非 HTTPS 协议",
    statusBaseLocalhost: "指向本地主机",
    statusBasePrivate: "使用内网或回环地址",
    baseUrlFormatError: "Base URL 格式不正确",
    saving: "保存中...",
    saveBasic: "保存基础设置",
    confirmRiskAndSave: "确认风险后保存",
  } satisfies TranslationDictionary,
  "zh-TW": {
    appName: "EchoNote",
    providerNoAi: "不使用 AI",
    providerChatgpt: "ChatGPT",
    providerDeepseek: "DeepSeek",
    greetingDawn: "凌晨好",
    greetingMorning: "早安",
    greetingAfternoon: "下午好",
    greetingEvening: "晚上好",
    homeSubline: "{greeting}! 今天是 {date}",
    homeTitle: "記下你的靈感與情緒節奏",
    homeTodayCta: "今日記錄",
    homeEditCta: "前往編輯",
    homeEditCtaWithDate: "編輯 {date}",
    homeSettings: "設定中心",
    calendarPrevMonth: "上一月",
    calendarNextMonth: "下一月",
    calendarCollapse: "收起月曆",
    calendarExpand: "展開月曆",
    timelineEmpty: "暫無日記",
    timelinePlaceholderTitle: "當日暫無內容",
    timelinePlaceholderHint: "點擊頂部按鈕開始記錄",
    timelineEmojiLabel: "每日 Emoji",
    timelineAiPending: "AI 摘要生成中...",
    editorHeadTitle: "編輯器",
    editorBackHome: "返回首頁",
    editorComplete: "完成",
    editorNoDate: "未選擇日期",
    editorPlaceholder: "記錄你的靈感、片刻與感悟...",
    settingsHeadTitle: "設定",
    settingsCaption: "設定中心",
    settingsBack: "返回",
    settingsLanguageTitle: "介面語言",
    settingsLanguageDescription: "切換應用介面的顯示語言。",
    settingsThemeTitle: "主題模式",
    settingsThemeDescription: "選擇與系統或個人偏好一致的外觀。",
    settingsThemeFollow: "跟隨系統",
    settingsThemeLight: "淺色",
    settingsThemeDark: "深色",
    settingsAiTitle: "AI 服務",
    settingsAiDescription: "選擇提供商、配置憑證並設定預設模型。",
    settingsApiType: "API 類型",
    settingsFixedBaseUrl: "該提供商使用固定 Base URL",
    settingsBaseUrlExample: "例如 https://api.openai.com/v1",
    settingsApiKeyHint:
      "保存後金鑰將加密存儲於後端，不會在前端回顯。若未填寫則複用已保存的金鑰。",
    settingsDefaultModel: "預設模型",
    settingsFetchModelsPlaceholder: "請先獲取模型列表",
    settingsRefreshModels: "重新整理模型",
    settingsRefreshingModels: "拉取中...",
    settingsModelTip: "推薦使用 Chat 模型，如 gpt-5.1-mini",
    settingsAdvancedTitle: "進階設定",
    settingsToggleAdvancedShow: "顯示進階設定",
    settingsToggleAdvancedHide: "隱藏進階設定",
    settingsCustomPrompt: "自訂 Prompt",
    settingsPromptTip: "推理模型通常耗時高且價值有限，可沿用該提示詞。",
    settingsTemperature: "溫度（0-1）",
    settingsTemperaturePlaceholder: "例如 0.3",
    settingsTemperatureTip: "推薦值：Chat 模型約 0.3。溫度越高越發散。",
    settingsMaxTokens: "最大輸出 Tokens",
    settingsMaxTokensPlaceholder: "例如 60 或 2048",
    settingsMaxTokensTip:
      "建議：Chat 模型約 60；推理模型約 2048（但多數場景並不值得啟用推理模型）。",
    settingsAiDisabledNote: "目前已關閉 AI，若需開啟請在上方選擇其他提供商。",
    settingsSaveAdvanced: "保存進階設定",
    settingsResetAdvanced: "恢復進階預設值並保存",
    settingsDeleteCustom: "刪除當前自訂介面",
    settingsAddCustomTitle: "新增 OpenAI API Custom",
    settingsCustomSuffix: "自訂名稱後綴",
    settingsCustomSuffixPlaceholder: "例如 team-a",
    settingsAddCustom: "添加自訂介面",
    statusUnsavedChanges: "存在未保存的變更",
    statusAiDisabled: "當前已關閉 AI",
    statusNoModels: "未返回可用模型",
    statusModelsFetched: "已識別 {count} 個模型",
    statusFetchModelsFailed: "無法獲取模型，請檢查設定",
    statusSuffixRequired: "請填寫自訂名稱後綴",
    statusSuffixDuplicate: "該後綴已存在，請更換",
    statusCustomAdded: "已添加自訂介面",
    statusDeleteCustomOnly: "僅可刪除自訂介面",
    statusDeleteSecretFailed: "刪除自訂金鑰失敗",
    statusCustomDeleted: "已刪除自訂介面",
    statusResetAdvanced: "已恢復進階預設值",
    statusApiKeyInvalid: "請輸入有效 API Key",
    statusAiOff: "已關閉 AI",
    statusAiOffFailed: "關閉失敗，請重試",
    statusModelRequired: "請選擇模型類型",
    statusBaseInvalid: "Base URL 無效",
    statusBaseRisk: "檢測到潛在風險（{warnings}），請再次點擊按鈕確認保存",
    statusBasicSaved: "基礎設定已保存",
    statusBasicSaveFailed: "保存基礎設定失敗",
    statusAdvancedSaved: "進階設定已保存",
    statusAdvancedSaveFailed: "保存進階設定失敗",
    statusAdvancedSaveBlocked: "當前已關閉 AI",
    statusBaseNonHttps: "使用非 HTTPS 協議",
    statusBaseLocalhost: "指向本地主機",
    statusBasePrivate: "使用內網或回環地址",
    baseUrlFormatError: "Base URL 格式不正確",
    saving: "保存中...",
    saveBasic: "保存基礎設定",
    confirmRiskAndSave: "確認風險後保存",
  } satisfies TranslationDictionary,
  ja: {
    appName: "EchoNote",
    providerNoAi: "AI なし",
    providerChatgpt: "ChatGPT",
    providerDeepseek: "DeepSeek",
    greetingDawn: "おはようございます",
    greetingMorning: "おはようございます",
    greetingAfternoon: "こんにちは",
    greetingEvening: "こんばんは",
    homeSubline: "{greeting}! 今日は {date} です",
    homeTitle: "ひらめきと感情のリズムを記録しましょう",
    homeTodayCta: "今日の記録",
    homeEditCta: "編集へ",
    homeEditCtaWithDate: "{date} を編集",
    homeSettings: "設定",
    calendarPrevMonth: "前の月",
    calendarNextMonth: "次の月",
    calendarCollapse: "カレンダーを閉じる",
    calendarExpand: "カレンダーを開く",
    timelineEmpty: "日記はまだありません",
    timelinePlaceholderTitle: "この日は内容がありません",
    timelinePlaceholderHint: "上部のボタンから記録を始めてください",
    timelineEmojiLabel: "毎日の絵文字",
    timelineAiPending: "AI 要約を生成中...",
    editorHeadTitle: "エディター",
    editorBackHome: "ホームに戻る",
    editorComplete: "完了",
    editorNoDate: "日付が選択されていません",
    editorPlaceholder: "アイデアや気持ちを自由に書き留めてください...",
    settingsHeadTitle: "設定",
    settingsCaption: "設定",
    settingsBack: "戻る",
    settingsLanguageTitle: "表示言語",
    settingsLanguageDescription: "アプリの表示言語を切り替えます。",
    settingsThemeTitle: "テーマモード",
    settingsThemeDescription:
      "システムまたは個人の好みに合った外観を選択してください。",
    settingsThemeFollow: "システムに合わせる",
    settingsThemeLight: "ライト",
    settingsThemeDark: "ダーク",
    settingsAiTitle: "AI サービス",
    settingsAiDescription:
      "プロバイダーを選び、資格情報を設定し、デフォルトモデルを指定します。",
    settingsApiType: "API 種類",
    settingsFixedBaseUrl: "このプロバイダーは固定の Base URL を使用します",
    settingsBaseUrlExample: "例: https://api.openai.com/v1",
    settingsApiKeyHint:
      "保存後、キーはバックエンドで暗号化され、画面には表示されません。空欄なら既存のキーを再利用します。",
    settingsDefaultModel: "デフォルトモデル",
    settingsFetchModelsPlaceholder: "まずモデル一覧を取得してください",
    settingsRefreshModels: "モデルを更新",
    settingsRefreshingModels: "取得中...",
    settingsModelTip: "gpt-5.1-mini などのチャットモデルを推奨します。",
    settingsAdvancedTitle: "詳細設定",
    settingsToggleAdvancedShow: "詳細設定を表示",
    settingsToggleAdvancedHide: "詳細設定を隠す",
    settingsCustomPrompt: "カスタムプロンプト",
    settingsPromptTip:
      "推論モデルは時間がかかるため、デフォルトのプロンプトで十分な場合が多いです。",
    settingsTemperature: "温度 (0-1)",
    settingsTemperaturePlaceholder: "例: 0.3",
    settingsTemperatureTip:
      "目安: チャットモデルは約 0.3。値が高いほど出力は多様になります。",
    settingsMaxTokens: "最大出力トークン",
    settingsMaxTokensPlaceholder: "例: 60 または 2048",
    settingsMaxTokensTip:
      "目安: チャットモデルは約 60。推論モデルは約 2048 (用途に応じて)。",
    settingsAiDisabledNote:
      "AI は無効です。上部で別のプロバイダーを選ぶと有効になります。",
    settingsSaveAdvanced: "詳細設定を保存",
    settingsResetAdvanced: "デフォルトに戻して保存",
    settingsDeleteCustom: "このカスタムプロバイダーを削除",
    settingsAddCustomTitle: "OpenAI API Custom を追加",
    settingsCustomSuffix: "カスタム名のサフィックス",
    settingsCustomSuffixPlaceholder: "例: team-a",
    settingsAddCustom: "カスタムを追加",
    statusUnsavedChanges: "未保存の変更があります",
    statusAiDisabled: "AI は無効です",
    statusNoModels: "利用可能なモデルがありません",
    statusModelsFetched: "{count} 件のモデルを検出しました",
    statusFetchModelsFailed: "モデルを取得できません。設定を確認してください",
    statusSuffixRequired: "カスタムのサフィックスを入力してください",
    statusSuffixDuplicate: "そのサフィックスは既に存在します",
    statusCustomAdded: "カスタムプロバイダーを追加しました",
    statusDeleteCustomOnly: "削除できるのはカスタムプロバイダーのみです",
    statusDeleteSecretFailed: "保存済みキーの削除に失敗しました",
    statusCustomDeleted: "カスタムプロバイダーを削除しました",
    statusResetAdvanced: "詳細設定をデフォルトに戻しました",
    statusApiKeyInvalid: "有効な API キーを入力してください",
    statusAiOff: "AI を無効にしました",
    statusAiOffFailed: "無効化に失敗しました。再試行してください",
    statusModelRequired: "モデル種別を選択してください",
    statusBaseInvalid: "Base URL が無効です",
    statusBaseRisk: "潜在的なリスク ({warnings}) が検出されました。もう一度クリックして保存を確認してください",
    statusBasicSaved: "基本設定を保存しました",
    statusBasicSaveFailed: "基本設定の保存に失敗しました",
    statusAdvancedSaved: "詳細設定を保存しました",
    statusAdvancedSaveFailed: "詳細設定の保存に失敗しました",
    statusAdvancedSaveBlocked: "AI は現在無効です",
    statusBaseNonHttps: "HTTPS ではありません",
    statusBaseLocalhost: "localhost を指しています",
    statusBasePrivate: "プライベートネットワークまたはループバックを指しています",
    baseUrlFormatError: "Base URL の形式が正しくありません",
    saving: "保存中...",
    saveBasic: "基本設定を保存",
    confirmRiskAndSave: "リスクを確認して保存",
  } satisfies TranslationDictionary,
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
  const formatter = new Intl.DateTimeFormat(targetLocale, { weekday: variant });
  const start = weekStartsOnMonday ? MONDAY_ANCHOR : SUNDAY_ANCHOR;
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(start + index * 86_400_000)),
  );
}
