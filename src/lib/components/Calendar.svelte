<script lang="ts">
    import { browser } from "$app/environment";
    import {
        getMonthDates,
        formatDate,
        isToday,
        isSameMonth,
    } from "$utils/date";
    import { listEntriesByMonth } from "$utils/backend";
    import {
        appStateStore,
        setCalendarExpanded,
        setCurrentDate,
        setSummaries,
        isMonthLoaded,
        markMonthAsLoaded,
    } from "$utils/state";
    import type { DiaryEntry } from "../../types";
    import {
        formatMonthTitle,
        getWeekdayLabels,
        locale,
        translator,
        type Locale,
    } from "$utils/i18n";

    const state = appStateStore;
    const localeStore = locale;
    const t = translator;
    let weekdayLabels: string[] = [];
    let localeValue: Locale = "zh-Hans";

    let year = new Date().getFullYear();
    let month = new Date().getMonth();
    let lastLoadedKey: string | null = null;

    $: currentDate = $state.currentDate;
    $: calendarExpanded = $state.calendarExpanded;
    $: summaries = $state.summaries;
    $: localeValue = $localeStore;
    $: weekdayLabels = getWeekdayLabels(localeValue, {
        weekStartsOnMonday: true,
        variant: "short",
    });

    $: gridDates = getMonthDates(year, month);
    $: weeks = chunkIntoWeeks(gridDates);
    $: selectedWeekIndex = getSelectedWeekIndex(gridDates, currentDate);
    $: selectedWeek = weeks[selectedWeekIndex] ?? weeks[0] ?? [];
    $: topWeeks = weeks.slice(0, selectedWeekIndex);
    $: bottomWeeks = weeks.slice(selectedWeekIndex + 1);

    $: if (browser && gridDates.length) {
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

        setCurrentDate(nextDate);
    }

    function toggleCalendarView(): void {
        setCalendarExpanded(!calendarExpanded);
    }

    function getCellClasses(
        date: Date,
        entry: DiaryEntry | null,
        selectedDate: string,
    ): string {
        const isCurrent = isSameMonth(date, year, month);
        const today = isToday(date);
        const selected = formatDate(date) === selectedDate;
        const hasEntry = Boolean(entry);

        const classes = ["date-cell"];

        if (!isCurrent) {
            classes.push("calendar-cell--muted");
        }

        if (selected) {
            classes.push("calendar-cell--selected");
        } else if (today) {
            classes.push("calendar-cell--today");
        } else if (hasEntry && isCurrent) {
            classes.push("calendar-cell--has-entry");
        }

        return classes.join(" ");
    }

    function getWeekKey(week: Date[], index: number): string {
        const signature = week.map((date) => formatDate(date)).join("-");
        return signature || `week-${index}`;
    }

    async function ensureMonthSummariesLoaded(grid: Date[]): Promise<void> {
        if (!browser || grid.length === 0) return;

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
            const promises: Promise<DiaryEntry[]>[] = [];

            if (
                hasPrevMonthDates &&
                !isMonthLoaded(prevYear, prevMonth1Based)
            ) {
                promises.push(
                    listEntriesByMonth(prevYear, prevMonth1Based).then(
                        (entries) => {
                            markMonthAsLoaded(prevYear, prevMonth1Based);
                            return entries;
                        },
                    ),
                );
            } else if (hasPrevMonthDates) {
                // Already loaded, push empty to keep structure if needed, or just handle logic below
                // Actually, if it's loaded, we don't need to fetch.
                // But setSummaries expects a list.
                // If we don't fetch, we don't update summaries?
                // Wait, setSummaries merges into the map. So if it's already loaded, we don't need to do anything for that month.
            }

            if (!isMonthLoaded(currentYear, currentMonth1Based)) {
                promises.push(
                    listEntriesByMonth(currentYear, currentMonth1Based).then(
                        (entries) => {
                            markMonthAsLoaded(currentYear, currentMonth1Based);
                            return entries;
                        },
                    ),
                );
            }

            if (promises.length > 0) {
                const results = await Promise.all(promises);
                const allEntries = results.flat();
                if (allEntries.length > 0) {
                    setSummaries(allEntries);
                }
            }
        } catch (error) {
            console.error("加载月度摘要失败:", error);
        }
    }
</script>

<div class="calendar">
    <div class="calendar__header">
        <div class="calendar__nav">
            <button
                type="button"
                class="icon-button"
                aria-label={$t("calendarPrevMonth")}
                on:click={goToPrevMonth}
            >
                <svg
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    width="18"
                    height="18"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 19l-7-7 7-7"
                    />
                </svg>
            </button>

            <p class="calendar__title">
                {formatMonthTitle(year, month, localeValue)}
            </p>

            <button
                type="button"
                class="icon-button"
                aria-label={$t("calendarNextMonth")}
                on:click={goToNextMonth}
            >
                <svg
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    width="18"
                    height="18"
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

        <button
            type="button"
            class="btn btn--ghost calendar__toggle"
            on:click={toggleCalendarView}
            aria-pressed={calendarExpanded}
        >
            {calendarExpanded ? $t("calendarCollapse") : $t("calendarExpand")}
        </button>
    </div>

    <div class="calendar__weekdays">
        {#each weekdayLabels as label}
            <span>{label}</span>
        {/each}
    </div>

    <div class="calendar__stack">
        {#if topWeeks.length}
            <div
                class="calendar-section calendar-section--collapsible"
                data-expanded={calendarExpanded ? "true" : "false"}
                aria-hidden={calendarExpanded ? "false" : "true"}
                inert={!calendarExpanded}
            >
                {#each topWeeks as week, index (getWeekKey(week, index))}
                    <div class="calendar__grid">
                        {#each week as date (formatDate(date))}
                            {@const entry =
                                summaries.get(formatDate(date)) ?? null}
                            <button
                                type="button"
                                class={getCellClasses(date, entry, currentDate)}
                                aria-pressed={formatDate(date) === currentDate}
                                on:click={() => handleDateClick(date)}
                            >
                                <span class="date-cell__value"
                                    >{date.getDate()}</span
                                >
                                {#if entry?.emoji}
                                    <span class="date-cell__emoji"
                                        >{entry.emoji}</span
                                    >
                                {/if}
                            </button>
                        {/each}
                    </div>
                {/each}
            </div>
        {/if}

        <div class="calendar__grid calendar__grid--featured" aria-live="polite">
            {#each selectedWeek as date (formatDate(date))}
                {@const entry = summaries.get(formatDate(date)) ?? null}
                <button
                    type="button"
                    class={getCellClasses(date, entry, currentDate)}
                    aria-current={isToday(date) ? "date" : undefined}
                    aria-pressed={formatDate(date) === currentDate}
                    on:click={() => handleDateClick(date)}
                >
                    <span class="date-cell__value">{date.getDate()}</span>
                    {#if entry?.emoji}
                        <span class="date-cell__emoji">{entry.emoji}</span>
                    {/if}
                </button>
            {/each}
        </div>

        {#if bottomWeeks.length}
            <div
                class="calendar-section calendar-section--collapsible"
                data-expanded={calendarExpanded ? "true" : "false"}
                aria-hidden={calendarExpanded ? "false" : "true"}
                inert={!calendarExpanded}
            >
                {#each bottomWeeks as week, index (getWeekKey(week, index + topWeeks.length + 1))}
                    <div class="calendar__grid">
                        {#each week as date (formatDate(date))}
                            {@const entry =
                                summaries.get(formatDate(date)) ?? null}
                            <button
                                type="button"
                                class={getCellClasses(date, entry, currentDate)}
                                aria-pressed={formatDate(date) === currentDate}
                                on:click={() => handleDateClick(date)}
                            >
                                <span class="date-cell__value"
                                    >{date.getDate()}</span
                                >
                                {#if entry?.emoji}
                                    <span class="date-cell__emoji"
                                        >{entry.emoji}</span
                                    >
                                {/if}
                            </button>
                        {/each}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .calendar {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .calendar__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .calendar__nav {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex: 1;
        min-width: 0;
    }

    .calendar__title {
        font-size: 1rem;
        font-weight: 600;
        text-align: center;
        flex: 1;
    }

    .calendar__weekdays {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.2rem;
        font-size: 0.78rem;
        text-align: center;
        color: var(--color-text-muted);
    }

    .calendar__stack {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .calendar__grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.25rem;
    }

    .calendar__grid--featured {
        position: relative;
    }

    .calendar-section {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .calendar-section--collapsible {
        --calendar-stack-max-duration: 550ms;
        --calendar-stack-opacity-duration: 360ms;
        overflow: hidden;
        transition:
            max-height var(--calendar-stack-max-duration)
                var(--motion-curve-emphasis),
            opacity var(--calendar-stack-opacity-duration)
                var(--motion-curve-standard);
        max-height: 0px;
        opacity: 0;
        pointer-events: none;
    }

    .calendar-section--collapsible[data-expanded="true"] {
        --calendar-stack-max-duration: 550ms;
        --calendar-stack-opacity-duration: 360ms;
        max-height: 520px;
        opacity: 1;
        pointer-events: auto;
    }

    .date-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.15rem;
        border-radius: var(--radius-md);
        border: 1px solid transparent;
        min-height: clamp(1.9rem, 6.5vh, 4.8rem);
        background: rgba(0, 0, 0, 0.02);
        transition:
            background 220ms var(--motion-curve-standard),
            color 220ms var(--motion-curve-standard),
            border 220ms var(--motion-curve-standard),
            transform 220ms var(--motion-curve-standard);
    }

    .calendar-cell--muted {
        color: var(--color-text-muted);
    }

    .calendar-cell--selected {
        color: var(--color-text-inverse);
        border-color: #fff;
        background: var(--color-accent);
        box-shadow: 0 8px 18px rgba(37, 99, 235, 0.35);
    }

    .calendar-cell--today {
        border-color: var(--color-accent);
    }

    .calendar-cell--has-entry {
        background: var(--color-accent-soft);
        color: var(--color-text);
    }

    .date-cell__value {
        font-weight: 600;
    }

    .date-cell__emoji {
        font-size: 0.75rem;
        color: var(--color-text-muted);
    }

    .calendar__toggle {
        margin-left: auto;
        padding-inline: 0.6rem;
    }

    @media (max-width: 640px) {
        .calendar__header {
            gap: 0.35rem;
        }

        .calendar__title {
            font-size: 0.95rem;
        }

        .calendar__toggle {
            font-size: 0.85rem;
            padding-inline: 0.5rem;
        }

        .calendar__weekdays {
            font-size: 0.72rem;
        }

        .date-cell {
            min-height: clamp(1.8rem, 7vw, 3.8rem);
        }
    }
</style>
