import { browser } from "$app/environment";
import { writable, type Readable } from "svelte/store";
import type { AppState, DiaryEntry } from "../types";

function loadThemePreference(): "light" | "dark" | "auto" {
  if (!browser) return "auto";
  const saved = localStorage.getItem("echonote-theme");
  if (saved === "light" || saved === "dark" || saved === "auto") {
    return saved;
  }
  return "auto";
}

const initialLayoutMode =
  browser &&
  typeof window !== "undefined" &&
  window.innerWidth > window.innerHeight
    ? "landscape"
    : "portrait";

const initialState: AppState = {
  currentDate: new Date().toISOString().split("T")[0],
  currentBody: null,
  summaries: new Map(),
  layoutMode: initialLayoutMode,
  calendarExpanded: initialLayoutMode === "landscape",
  theme: loadThemePreference(),
};

const internalStore = writable<AppState>(initialState);
let currentState = initialState;

internalStore.subscribe((value) => {
  currentState = value;
});

export const appStateStore: Readable<AppState> = {
  subscribe: internalStore.subscribe,
};

export function setState(updates: Partial<AppState>): void {
  internalStore.update((prev) => ({ ...prev, ...updates }));
}

export function getState(): AppState {
  return currentState;
}

export function setCurrentDate(date: string): void {
  setState({ currentDate: date });
}

export function setCurrentBody(body: string | null): void {
  setState({ currentBody: body });
}

export function setLayoutMode(mode: "portrait" | "landscape"): void {
  const defaultExpanded = mode === "landscape";
  setState({ layoutMode: mode, calendarExpanded: defaultExpanded });
}

export function setSummaries(entries: DiaryEntry[]): void {
  const updated = new Map(currentState.summaries);
  for (const entry of entries) {
    updated.set(entry.date, entry);
  }
  setState({ summaries: updated });
}

export function upsertSummary(entry: DiaryEntry): void {
  const updated = new Map(currentState.summaries);
  updated.set(entry.date, entry);
  setState({ summaries: updated });
}

export function getAllSummaries(): DiaryEntry[] {
  return Array.from(currentState.summaries.values()).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

export function getSummary(date: string): DiaryEntry | null {
  return currentState.summaries.get(date) || null;
}

export function setCalendarExpanded(expanded: boolean): void {
  setState({ calendarExpanded: expanded });
}

let layoutListenerInitialized = false;
export function initLayoutListener(): void {
  if (!browser || layoutListenerInitialized) return;
  layoutListenerInitialized = true;
  const updateLayout = () => {
    const newMode =
      window.innerWidth > window.innerHeight ? "landscape" : "portrait";
    if (newMode !== currentState.layoutMode) {
      setLayoutMode(newMode);
    }
  };

  window.addEventListener("resize", updateLayout);
  updateLayout();
}

export function setTheme(theme: "light" | "dark" | "auto"): void {
  setState({ theme });
  if (browser) {
    localStorage.setItem("echonote-theme", theme);
  }
  applyTheme(theme);
}

function applyTheme(theme: "light" | "dark" | "auto"): void {
  if (!browser) return;
  const html = document.documentElement;

  if (theme === "auto") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    html.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    html.setAttribute("data-theme", theme);
  }
}

let themeListenerInitialized = false;
export function initThemeListener(): void {
  if (!browser || themeListenerInitialized) return;
  themeListenerInitialized = true;
  applyTheme(currentState.theme);

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => {
    if (currentState.theme === "auto") {
      applyTheme("auto");
    }
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener("change", handleChange);
  } else {
    mediaQuery.addListener(handleChange);
  }
}
