<script lang="ts">
  import { getMonthDates, formatDate, isToday, isSameMonth } from "$utils/date";
  import { listEntriesByMonth } from "$utils/backend";
  import {
    appStateStore,
    setState,
    setSummaries,
    toggleTheme,
  } from "$utils/state";
  import { UI } from "$utils/ui";
  import type { DiaryEntry } from "../../types";

  const state = appStateStore;

  const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];

  let year = new Date().getFullYear();
  let month = new Date().getMonth();
  let lastLoadedKey: string | null = null;

  $: currentDate = $state.currentDate;
  $: calendarExpanded = $state.calendarExpanded;
  $: summaries = $state.summaries;
  $: theme = $state.theme;

  $: gridDates = getMonthDates(year, month);
  $: weeks = chunkIntoWeeks(gridDates);
  $: selectedWeekIndex = getSelectedWeekIndex(gridDates, currentDate);
  $: selectedWeek = weeks[selectedWeekIndex] ?? weeks[0] ?? [];
  $: topWeeks = weeks.slice(0, selectedWeekIndex);
  $: bottomWeeks = weeks.slice(selectedWeekIndex + 1);

  $: themeMeta = getThemeMeta(theme);
  $: themeIcon = themeMeta.icon;
  $: themeText = themeMeta.label;

  $: if (gridDates.length) {
    void ensureMonthSummariesLoaded(gridDates);
  }

  function chunkIntoWeeks(dates: Date[]): Date[][] {
    const result: Date[][] = [];
    for (let i = 0; i < dates.length; i += 7) {
      result.push(dates.slice(i, i + 7));
    }
    return result;
  }

  function getSelectedWeekIndex(dates: Date[], targetDate: string): number {
    const index = dates.findIndex((d) => formatDate(d) === targetDate);
    if (index === -1) return 0;
    return Math.floor(index / 7);
  }

  function goToPrevMonth(): void {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }

  function goToNextMonth(): void {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  function handleDateClick(date: Date): void {
    const nextDate = formatDate(date);
    const nextMonth = date.getMonth();
    const nextYear = date.getFullYear();

    if (nextMonth !== month || nextYear !== year) {
      month = nextMonth;
      year = nextYear;
    }

    setState({ currentDate: nextDate, viewMode: "editor" });
  }

  function getEntry(date: Date): DiaryEntry | null {
    return summaries.get(formatDate(date)) ?? null;
  }

  function getCellClasses(date: Date, entry: DiaryEntry | null): string {
    const isCurrent = isSameMonth(date, year, month);
    const today = isToday(date);
    const selected = formatDate(date) === currentDate;
    const hasEntry = Boolean(entry);

    const base = [
      UI.DATE_CELL,
      isCurrent
        ? "text-(--color-text-primary)"
        : "text-(--color-text-tertiary)",
      !today ? "hover:bg-(--color-bg-hover)" : "",
    ];

    if (today) {
      base.push(
        "bg-(--color-primary)",
        "text-(--color-text-inverse)",
        "font-semibold",
        "shadow-sm",
      );
      if (selected) {
        base.push("ring-2", "ring-white/70");
      }
    } else if (selected) {
      base.push(
        "border-2",
        "border-(--color-primary)",
        "text-(--color-text-primary)",
      );
      if (hasEntry) {
        base.push("bg-(--color-success-light)");
      }
    } else if (hasEntry && isCurrent) {
      base.push("bg-(--color-success-light)");
    }

    return base.filter(Boolean).join(" ");
  }

  function getThemeMeta(themeValue: "light" | "dark" | "auto"): {
    icon: string;
    label: string;
  } {
    switch (themeValue) {
      case "light":
        return { icon: "☀️", label: "浅色" };
      case "dark":
        return { icon: "🌙", label: "深色" };
      default:
        return { icon: "🌀", label: "自动" };
    }
  }

  async function ensureMonthSummariesLoaded(grid: Date[]): Promise<void> {
    if (grid.length === 0) return;

    const hasPrevMonthDates =
      grid[0].getMonth() !== month || grid[0].getFullYear() !== year;

    const currentYear = year;
    const currentMonth1Based = month + 1;

    let prevYear = currentYear;
    let prevMonth1Based = currentMonth1Based - 1;
    if (prevMonth1Based === 0) {
      prevMonth1Based = 12;
      prevYear -= 1;
    }

    const loadKey = `${currentYear}-${currentMonth1Based}-${hasPrevMonthDates ? "with-prev" : "single"}`;
    if (lastLoadedKey === loadKey) return;
    lastLoadedKey = loadKey;

    try {
      if (hasPrevMonthDates) {
        const [prevSummaries, currSummaries] = await Promise.all([
          listEntriesByMonth(prevYear, prevMonth1Based),
          listEntriesByMonth(currentYear, currentMonth1Based),
        ]);
        setSummaries([...prevSummaries, ...currSummaries]);
      } else {
        const currSummaries = await listEntriesByMonth(
          currentYear,
          currentMonth1Based,
        );
        setSummaries(currSummaries);
      }
    } catch (error) {
      console.error("加载月度摘要失败:", error);
    }
  }
</script>

<div class="calendar space-y-4">
  <div class="flex items-center justify-between">
    <button
      type="button"
      class={UI.ICON_BTN}
      aria-label="上一月"
      on:click={goToPrevMonth}
    >
      <svg
        class="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        />
      </svg>
    </button>

    <div class="text-center">
      <p class={UI.SECTION_HEADER}>{year}年{month + 1}月</p>
      <p class={`text-xs ${UI.MUTED}`}>当前视图同步日历展开状态</p>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class={`${UI.ICON_BTN} gap-1 px-3 py-1 w-auto! h-auto! rounded-full text-sm font-medium`}
        on:click={toggleTheme}
        title={`切换主题 (当前: ${themeText})`}
      >
        <span aria-hidden="true">{themeIcon}</span>
        <span>{themeText}</span>
      </button>
      <button
        type="button"
        class={UI.ICON_BTN}
        aria-label="下一月"
        on:click={goToNextMonth}
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  </div>

  <div class="grid grid-cols-7 gap-1 mb-1">
    {#each weekdayLabels as label}
      <div class={`text-center text-xs font-medium py-2 ${UI.MUTED}`}>
        {label}
      </div>
    {/each}
  </div>

  <div
    class={`calendar-section ${calendarExpanded ? "calendar-section--expanded" : "calendar-section--collapsed"}`}
    aria-hidden={calendarExpanded ? "false" : "true"}
  >
    {#each topWeeks as week}
      <div class="grid grid-cols-7 gap-1 mb-1">
        {#each week as date (formatDate(date))}
          {@const entry = getEntry(date)}
          <button
            type="button"
            class={getCellClasses(date, entry)}
            on:click={() => handleDateClick(date)}
            aria-pressed={formatDate(date) === currentDate}
          >
            <span class="text-sm font-medium">{date.getDate()}</span>
            {#if entry?.mood}
              <span class="text-xs mt-0.5">{entry.mood}</span>
            {/if}
            {#if entry && !isToday(date) && formatDate(date) !== currentDate}
              <span class="entry-dot" aria-hidden="true"></span>
            {/if}
          </button>
        {/each}
      </div>
    {/each}
  </div>

  <div class="grid grid-cols-7 gap-1 mb-1" aria-live="polite">
    {#each selectedWeek as date (formatDate(date))}
      {@const entry = getEntry(date)}
      <button
        type="button"
        class={getCellClasses(date, entry)}
        aria-current={isToday(date) ? "date" : undefined}
        aria-pressed={formatDate(date) === currentDate}
        on:click={() => handleDateClick(date)}
      >
        <span class="text-sm font-medium">{date.getDate()}</span>
        {#if entry?.mood}
          <span class="text-xs mt-0.5">{entry.mood}</span>
        {/if}
        {#if entry && !isToday(date) && formatDate(date) !== currentDate}
          <span class="entry-dot" aria-hidden="true"></span>
        {/if}
      </button>
    {/each}
  </div>

  <div
    class={`calendar-section ${calendarExpanded ? "calendar-section--expanded" : "calendar-section--collapsed"}`}
    aria-hidden={calendarExpanded ? "false" : "true"}
  >
    {#each bottomWeeks as week}
      <div class="grid grid-cols-7 gap-1 mb-1">
        {#each week as date (formatDate(date))}
          {@const entry = getEntry(date)}
          <button
            type="button"
            class={getCellClasses(date, entry)}
            on:click={() => handleDateClick(date)}
            aria-pressed={formatDate(date) === currentDate}
          >
            <span class="text-sm font-medium">{date.getDate()}</span>
            {#if entry?.mood}
              <span class="text-xs mt-0.5">{entry.mood}</span>
            {/if}
            {#if entry && !isToday(date) && formatDate(date) !== currentDate}
              <span class="entry-dot" aria-hidden="true"></span>
            {/if}
          </button>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .calendar-section {
    overflow: hidden;
    transition:
      max-height 0.3s ease,
      opacity 0.25s ease;
  }

  .calendar-section--collapsed {
    max-height: 0;
    opacity: 0;
  }

  .calendar-section--expanded {
    max-height: 30rem;
    opacity: 1;
  }

  .entry-dot {
    position: absolute;
    bottom: 0.35rem;
    width: 0.25rem;
    height: 0.25rem;
    border-radius: 9999px;
    background: var(--color-success);
  }

  .calendar button {
    background: transparent;
  }
</style>
