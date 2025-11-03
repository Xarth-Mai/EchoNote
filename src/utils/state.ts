// 简单的状态管理

import type { AppState, DiaryEntry } from '../types';

/** 从 localStorage 加载主题偏好 */
function loadThemePreference(): 'light' | 'dark' | 'auto' {
  const saved = localStorage.getItem('echonote-theme');
  if (saved === 'light' || saved === 'dark' || saved === 'auto') {
    return saved;
  }
  return 'auto'; // 默认跟随系统
}

/** 全局应用状态 */
export const state: AppState = {
  currentDate: new Date().toISOString().split('T')[0],
  currentEntry: null,
  entries: new Map(),
  viewMode: 'home',
  layoutMode: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
  calendarExpanded: false, // 默认收起
  editorFullscreen: false,
  theme: loadThemePreference(),
};

/** 状态变更监听器 */
type StateListener = (state: AppState) => void;
const listeners: StateListener[] = [];

/** 订阅状态变更 */
export function subscribe(listener: StateListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };
}

/** 更新状态并通知监听器 */
export function setState(updates: Partial<AppState>): void {
  Object.assign(state, updates);
  listeners.forEach(listener => listener(state));
}

/** 设置当前日期 */
export function setCurrentDate(date: string): void {
  setState({ currentDate: date });
}

/** 设置当前条目 */
export function setCurrentEntry(entry: DiaryEntry | null): void {
  setState({ currentEntry: entry });
}

/** 切换视图模式 */
export function setViewMode(mode: 'home' | 'editor'): void {
  setState({ viewMode: mode });
}

/** 设置布局模式 */
export function setLayoutMode(mode: 'portrait' | 'landscape'): void {
  setState({ layoutMode: mode });
}

/** 添加或更新条目 */
export function saveEntry(entry: DiaryEntry): void {
  state.entries.set(entry.date, entry);
  setState({ currentEntry: entry });
}

/** 获取所有条目（按日期倒序） */
export function getAllEntries(): DiaryEntry[] {
  return Array.from(state.entries.values())
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** 获取指定日期的条目 */
export function getEntry(date: string): DiaryEntry | null {
  return state.entries.get(date) || null;
}

/** 切换日历展开/收起状态 */
export function toggleCalendarExpanded(): void {
  setState({ calendarExpanded: !state.calendarExpanded });
}

/** 设置日历展开状态 */
export function setCalendarExpanded(expanded: boolean): void {
  setState({ calendarExpanded: expanded });
}

/** 切换编辑器全屏状态 */
export function toggleEditorFullscreen(): void {
  setState({ editorFullscreen: !state.editorFullscreen });
}

/** 设置编辑器全屏状态 */
export function setEditorFullscreen(fullscreen: boolean): void {
  setState({ editorFullscreen: fullscreen });
}

/** 监听窗口大小变化 */
export function initLayoutListener(): void {
  const updateLayout = () => {
    const newMode = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    if (newMode !== state.layoutMode) {
      setLayoutMode(newMode);
      // 切换到竖屏时，重置全屏状态
      if (newMode === 'portrait') {
        setEditorFullscreen(false);
      }
    }
  };

  window.addEventListener('resize', updateLayout);
  updateLayout();
}

/** 设置主题 */
export function setTheme(theme: 'light' | 'dark' | 'auto'): void {
  setState({ theme });
  localStorage.setItem('echonote-theme', theme);
  applyTheme(theme);
}

/** 循环切换主题 */
export function toggleTheme(): void {
  const themeOrder: Array<'light' | 'dark' | 'auto'> = ['auto', 'light', 'dark'];
  const currentIndex = themeOrder.indexOf(state.theme);
  const nextIndex = (currentIndex + 1) % themeOrder.length;
  setTheme(themeOrder[nextIndex]);
}

/** 应用主题到 DOM */
function applyTheme(theme: 'light' | 'dark' | 'auto'): void {
  const html = document.documentElement;

  if (theme === 'auto') {
    // 跟随系统
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    html.setAttribute('data-theme', theme);
  }
}

/** 初始化主题监听器 */
export function initThemeListener(): void {
  // 应用初始主题
  applyTheme(state.theme);

  // 监听系统主题变化（仅在 auto 模式下生效）
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => {
    if (state.theme === 'auto') {
      applyTheme('auto');
    }
  };

  // 使用新的 API（如果可用）
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
  } else {
    // 兼容旧浏览器
    mediaQuery.addListener(handleChange);
  }
}

