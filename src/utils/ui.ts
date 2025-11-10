export const UI = {
  BTN_GHOST:
    "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 text-(--color-primary) hover:bg-(--color-primary-hover)",

  ICON_BTN:
    "w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 text-(--color-primary) hover:bg-(--color-primary-hover)",

  CARD: "rounded-xl border border-(--color-border-primary) bg-(--color-bg-primary) transition hover:shadow-md hover:border-(--color-primary)",

  SECTION_HEADER:
    "text-base font-semibold tracking-tight text-(--color-text-primary)",

  MUTED: "text-(--color-text-secondary)",

  DATE_CELL:
    "date-cell aspect-square flex flex-col items-center justify-center rounded-full cursor-pointer transition-all duration-200 relative select-none",

  ENTRY_PREVIEW:
    "text-sm leading-relaxed line-clamp-3 text-(--color-text-primary) opacity-80",

  ENTRY_SUMMARY:
    "mt-3 px-3 py-2 rounded-lg text-xs leading-relaxed bg-(--color-primary-light) border border-(--color-border-secondary) text-(--color-text-primary) opacity-70",

  ENTRY_SUMMARY_ICON: "text-(--color-primary)",
} as const;

export function cx(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
