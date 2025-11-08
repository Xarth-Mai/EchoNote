<script lang="ts">
  import { get } from 'svelte/store';
  import { cubicOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';

  import { listEntriesByMonth } from '../utils/backend';
  import { formatDate, getMonthDates, isSameMonth, isToday } from '../utils/date';
  import {
    appState,
    setCurrentDate,
    setSummaries,
    toggleCalendarExpanded,
    toggleTheme,
  } from '../utils/state';

  const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];

  let year = new Date().getFullYear();
  let monthIndex = new Date().getMonth();
  let lastLoadedKey: string | null = null;
  let pendingLoadKey: string | null = null;
  let isMonthLoading = false;
  let monthError: string | null = null;

  $: dates = getMonthDates(year, monthIndex);
  $: weeks = toWeeks(dates);
  $: selectedDate = $appState.currentDate;
  $: expanded = $appState.calendarExpanded;
  $: summaries = $appState.summaries;
  $: theme = $appState.theme;

  $: selectedWeekIndex = weeks.findIndex((week) =>
    week.some((date) => formatDate(date) === selectedDate)
  );
  $: normalizedSelectedWeek = selectedWeekIndex === -1 ? 0 : selectedWeekIndex;

  $: void ensureMonthSummariesLoaded(dates, year, monthIndex);

  function toWeeks(allDates: Date[]): Date[][] {
    const grouped: Date[][] = [];
    for (let i = 0; i < allDates.length; i += 7) {
      grouped.push(allDates.slice(i, i + 7));
    }
    return grouped;
  }

  function goPrevMonth(): void {
    monthIndex -= 1;
    if (monthIndex < 0) {
      monthIndex = 11;
      year -= 1;
    }
  }

  function goNextMonth(): void {
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
  }

  function handleSelectDate(date: Date): void {
    const iso = formatDate(date);
    setCurrentDate(iso);
  }

  function themeIcon(current: 'light' | 'dark' | 'auto'): string {
    switch (current) {
      case 'light':
        return '🌞';
      case 'dark':
        return '🌙';
      default:
        return '🌓';
    }
  }

  function themeText(current: 'light' | 'dark' | 'auto'): string {
    switch (current) {
      case 'light':
        return '浅色模式';
      case 'dark':
        return '深色模式';
      default:
        return '跟随系统';
    }
  }

  function hasEntry(date: Date): boolean {
    return summaries.has(formatDate(date));
  }

  function entryMood(date: Date): string | undefined {
    return summaries.get(formatDate(date))?.mood;
  }

  async function ensureMonthSummariesLoaded(
    dates: Date[],
    year: number,
    monthIndex: number
  ): Promise<void> {
    if (!dates.length) return;

    const hasPrevMonthDates = !isSameMonth(dates[0], year, monthIndex);
    const currentYear = year;
    const currentMonth1Based = monthIndex + 1;
    const loadKey = `${currentYear}-${currentMonth1Based}-${hasPrevMonthDates ? 'with-prev' : 'single'}`;

    if (lastLoadedKey === loadKey || pendingLoadKey === loadKey) return;
    pendingLoadKey = loadKey;

    try {
      isMonthLoading = true;
      const existingEntries = new Map(
        Array.from(get(appState).summaries.values()).map((entry) => [entry.date, entry])
      );
      if (hasPrevMonthDates) {
        const prevMonth = currentMonth1Based === 1 ? 12 : currentMonth1Based - 1;
        const prevYear = prevMonth === 12 ? currentYear - 1 : currentYear;
        const [prevSummaries, currSummaries] = await Promise.all([
          listEntriesByMonth(prevYear, prevMonth),
          listEntriesByMonth(currentYear, currentMonth1Based),
        ]);
        for (const entry of [...prevSummaries, ...currSummaries]) {
          existingEntries.set(entry.date, entry);
        }
      } else {
        const currSummaries = await listEntriesByMonth(currentYear, currentMonth1Based);
        for (const entry of currSummaries) {
          existingEntries.set(entry.date, entry);
        }
      }
      setSummaries(Array.from(existingEntries.values()));
      lastLoadedKey = loadKey;
      monthError = null;
    } catch (error) {
      console.error('加载月度日记摘要失败:', error);
      monthError = '同步月度日记失败';
    } finally {
      isMonthLoading = false;
      if (pendingLoadKey === loadKey) {
        pendingLoadKey = null;
      }
    }
  }
</script>

<section class="glow-card relative rounded-3xl border border-(--color-border-primary) bg-(--color-bg-primary)/80 p-5 shadow-[0_25px_60px_-40px_rgba(15,23,42,0.55)] backdrop-blur-xl">
  <header class="mb-4 flex items-center justify-between">
    <button
      class="group flex h-9 w-9 items-center justify-center rounded-full border border-(--color-border-secondary) text-(--color-text-secondary) shadow-sm transition hover:-translate-x-0.5 hover:border-(--color-primary) hover:text-(--color-primary)"
      on:click={goPrevMonth}
      aria-label="上个月"
    >
      <svg class="h-4 w-4 transition group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    <div class="text-center">
      <h2 class="text-lg font-semibold tracking-tight">
        {year}年{monthIndex + 1}月
      </h2>
      <p class="text-xs text-(--color-text-secondary)">
        {selectedDate}
      </p>
    </div>

    <div class="flex items-center gap-2">
      <button
        class="flex h-9 items-center gap-2 rounded-full border border-(--color-border-secondary) bg-(--color-bg-secondary)/80 px-4 text-sm font-medium text-(--color-text-secondary) shadow-sm transition hover:border-(--color-primary) hover:text-(--color-primary)"
        on:click={toggleTheme}
        title={`切换主题（当前：${themeText(theme)}）`}
      >
        <span>{themeIcon(theme)}</span>
        <span class="hidden sm:inline">{themeText(theme)}</span>
      </button>
      <button
        class="group flex h-9 w-9 items-center justify-center rounded-full border border-(--color-border-secondary) text-(--color-text-secondary) shadow-sm transition hover:translate-x-0.5 hover:border-(--color-primary) hover:text-(--color-primary)"
        on:click={goNextMonth}
        aria-label="下个月"
      >
        <svg class="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </header>

  <div class="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-(--color-text-secondary)">
    {#each weekdayLabels as day}
      <span>{day}</span>
    {/each}
  </div>

  <div class="relative mt-3 space-y-2 overflow-hidden">
    {#each weeks as week, index (formatDate(week[0]))}
      {#if expanded || index === normalizedSelectedWeek}
        <div
          class="grid grid-cols-7 gap-2"
          in:fly={{ y: index < normalizedSelectedWeek ? -16 : 16, duration: 220, easing: cubicOut }}
          out:fade={{ duration: 120 }}
        >
          {#each week as date (formatDate(date))}
            <button
              class={`group relative flex h-16 flex-col items-center justify-center rounded-2xl border border-transparent text-sm transition-all duration-200 ${
                isSameMonth(date, year, monthIndex)
                  ? 'text-(--color-text-primary)'
                  : 'text-(--color-text-secondary)/60'
              } ${
                formatDate(date) === selectedDate
                  ? 'bg-gradient-to-br from-(--color-primary-light) via-(--color-primary-hover)/60 to-transparent text-(--color-primary) shadow-[0_12px_30px_-18px_rgba(14,116,144,0.6)]'
                  : 'hover:border-(--color-border-secondary) hover:bg-(--color-bg-secondary)/70'
              } ${
                isToday(date) ? 'ring-1 ring-(--color-primary)/50' : ''
              }`}
              on:click={() => handleSelectDate(date)}
            >
              <span class="text-xs font-medium uppercase tracking-tight text-(--color-text-secondary)">{date.getDate()}</span>
              {#if hasEntry(date)}
                <span class="mt-1 flex items-center gap-1 text-[10px] text-(--color-text-secondary)">
                  <span class="h-1.5 w-1.5 rounded-full bg-(--color-primary)"></span>
                  {#if entryMood(date)}
                    <span class="text-base leading-none">{entryMood(date)}</span>
                  {/if}
                </span>
              {:else if entryMood(date)}
                <span class="mt-1 text-base leading-none">{entryMood(date)}</span>
              {/if}
              {#if formatDate(date) === selectedDate}
                <span
                  class="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-(--color-primary-light) opacity-0 transition-opacity duration-300 group-hover:opacity-60"
                ></span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    {/each}
  </div>

  <div class="mt-4 flex items-center justify-between text-xs text-(--color-text-secondary)">
    <div class="flex items-center gap-2">
      <span class="h-2 w-2 rounded-full bg-(--color-primary)"></span>
      <span>表示当日已记录</span>
    </div>
    <button
      class="flex items-center gap-2 rounded-full bg-(--color-bg-secondary)/80 px-4 py-1.5 text-xs font-medium text-(--color-primary) shadow-sm transition hover:-translate-y-0.5 hover:bg-(--color-primary-hover)"
      on:click={toggleCalendarExpanded}
      type="button"
    >
      <span>{expanded ? '收起月历' : '展开月历'}</span>
      <svg class={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  </div>

  {#if isMonthLoading}
    <div class="absolute right-5 top-5 flex items-center gap-2 rounded-full bg-(--color-bg-secondary)/80 px-3 py-1 text-[11px] text-(--color-text-secondary) shadow-sm">
      <span class="h-2 w-2 animate-ping rounded-full bg-(--color-primary)"></span>
      <span>同步中</span>
    </div>
  {/if}

  {#if monthError}
    <div class="mt-3 rounded-2xl border border-red-300/70 bg-red-500/10 px-3 py-2 text-xs text-red-200">
      {monthError}
    </div>
  {/if}
</section>
