// EchoNote 类型定义

/** 日记条目 */
export interface DiaryEntry {
  hlc?: string; // $Timestamp-$LogicalCounter-DeviceID
  hash?: string; // BLAKE3
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
