// EchoNote 类型定义

/** 日记条目 */
export interface DiaryEntry {
  date: string; // YYYY-MM-DD 格式
  content: string; // Markdown 内容
  mood?: string; // 心情 emoji
  aiSummary?: string; // AI 生成的摘要
}

/** 应用状态 */
export interface AppState {
  currentDate: string; // 当前选中的日期
  currentEntry: DiaryEntry | null; // 当前编辑的条目
  entries: Map<string, DiaryEntry>; // 所有日记条目，key 为日期
  viewMode: 'home' | 'editor'; // 当前视图模式：home=日历+时间线组合，editor=编辑器
  layoutMode: 'portrait' | 'landscape'; // 布局模式
  calendarExpanded: boolean; // 日历是否展开
  editorFullscreen: boolean; // 编辑器是否全屏（仅横屏模式）
  theme: 'light' | 'dark' | 'auto'; // 主题模式：light=浅色，dark=深色，auto=跟随系统
}

