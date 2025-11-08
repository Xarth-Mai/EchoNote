import { derived, get, writable } from 'svelte/store';
import type { AppState, DiaryEntry } from '../types';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function loadThemePreference(): 'light' | 'dark' | 'auto' {
  if (!isBrowser()) return 'auto';

  try {
    const saved = window.localStorage.getItem('echonote-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      return saved;
    }
  } catch (error) {
    console.warn('读取主题偏好失败:', error);
  }
  return 'auto';
}

const defaultLayout: AppState['layoutMode'] = isBrowser() && window.innerWidth > window.innerHeight
  ? 'landscape'
  : 'portrait';

const initialState: AppState = {
  currentDate: new Date().toISOString().split('T')[0],
  currentBody: null,
  summaries: new Map(),
  viewMode: 'home',
  layoutMode: defaultLayout,
  calendarExpanded: false,
  editorFullscreen: false,
  theme: loadThemePreference(),
};

const appStateStore = writable<AppState>(initialState);

export const appState = {
  subscribe: appStateStore.subscribe,
};

export const summariesList = derived(appStateStore, (state) =>
  Array.from(state.summaries.values()).sort((a, b) => b.date.localeCompare(a.date))
);

function setState(updates: Partial<AppState>): void {
  appStateStore.update((current) => ({
    ...current,
    ...updates,
  }));
}

export function setCurrentDate(date: string): void {
  setState({ currentDate: date, currentBody: null });
}

export function setCurrentBody(body: string | null): void {
  setState({ currentBody: body });
}

export function setViewMode(mode: AppState['viewMode']): void {
  setState({ viewMode: mode });
}

export function setLayoutMode(mode: AppState['layoutMode']): void {
  setState({ layoutMode: mode });
}

export function setSummaries(entries: DiaryEntry[]): void {
  const map = new Map<string, DiaryEntry>();
  for (const entry of entries) {
    map.set(entry.date, entry);
  }
  setState({ summaries: map });
}

export function upsertSummary(entry: DiaryEntry): void {
  appStateStore.update((current) => {
    const summaries = new Map(current.summaries);
    summaries.set(entry.date, entry);
    return {
      ...current,
      summaries,
    };
  });
}

export function getAllSummaries(): DiaryEntry[] {
  return Array.from(get(appStateStore).summaries.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function getSummary(date: string): DiaryEntry | null {
  return get(appStateStore).summaries.get(date) ?? null;
}

export function toggleCalendarExpanded(): void {
  const { calendarExpanded } = get(appStateStore);
  setState({ calendarExpanded: !calendarExpanded });
}

export function setCalendarExpanded(expanded: boolean): void {
  setState({ calendarExpanded: expanded });
}

export function toggleEditorFullscreen(): void {
  const { editorFullscreen } = get(appStateStore);
  setState({ editorFullscreen: !editorFullscreen });
}

export function setEditorFullscreen(fullscreen: boolean): void {
  setState({ editorFullscreen: fullscreen });
}

export function initLayoutListener(): () => void {
  if (!isBrowser()) return () => undefined;

  const updateLayout = () => {
    const mode: AppState['layoutMode'] = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    if (mode !== get(appStateStore).layoutMode) {
      setLayoutMode(mode);
      if (mode === 'portrait') {
        setEditorFullscreen(false);
      }
    }
  };

  window.addEventListener('resize', updateLayout);
  updateLayout();

  return () => {
    window.removeEventListener('resize', updateLayout);
  };
}

function applyTheme(theme: AppState['theme']): void {
  if (!isBrowser()) return;
  const html = document.documentElement;

  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    html.setAttribute('data-theme', theme);
  }
}

export function setTheme(theme: AppState['theme']): void {
  setState({ theme });
  if (isBrowser()) {
    try {
      window.localStorage.setItem('echonote-theme', theme);
    } catch (error) {
      console.warn('保存主题偏好失败:', error);
    }
  }
  applyTheme(theme);
}

export function toggleTheme(): void {
  const order: AppState['theme'][] = ['auto', 'light', 'dark'];
  const currentTheme = get(appStateStore).theme;
  const index = order.indexOf(currentTheme);
  const nextTheme = order[(index + 1) % order.length];
  setTheme(nextTheme);
}

export function initThemeListener(): () => void {
  if (!isBrowser()) return () => undefined;

  applyTheme(get(appStateStore).theme);

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => {
    if (get(appStateStore).theme === 'auto') {
      applyTheme('auto');
    }
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
  } else {
    const legacy = mediaQuery as MediaQueryList & {
      addListener?: (listener: (this: MediaQueryList, event: MediaQueryListEvent) => void) => void;
    };
    legacy.addListener?.(handleChange);
  }

  return () => {
    if (mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', handleChange);
    } else {
      const legacy = mediaQuery as MediaQueryList & {
        removeListener?: (listener: (this: MediaQueryList, event: MediaQueryListEvent) => void) => void;
      };
      legacy.removeListener?.(handleChange);
    }
  };
}
