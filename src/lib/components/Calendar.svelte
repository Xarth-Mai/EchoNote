<script lang="ts">
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
    } from "$utils/state";
    import type { DiaryEntry } from "../../types";

    const state = appStateStore;
    const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];

    let year = new Date().getFullYear();
    let month = new Date().getMonth();
    let lastLoadedKey: string | null = null;

    $: currentDate = $state.currentDate;
    $: calendarExpanded = $state.calendarExpanded;
    $: summaries = $state.summaries;

    $: gridDates = getMonthDates(year, month);
    $: weeks = chunkIntoWeeks(gridDates);
    $: selectedWeekIndex = getSelectedWeekIndex(gridDates, currentDate);
    $: selectedWeek = weeks[selectedWeekIndex] ?? weeks[0] ?? [];
    $: topWeeks = weeks.slice(0, selectedWeekIndex);
    $: bottomWeeks = weeks.slice(selectedWeekIndex + 1);

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

        setCurrentDate(nextDate);
    }

    function toggleCalendarView(): void {
        setCalendarExpanded(!calendarExpanded);
    }

    function getEntry(date: Date): DiaryEntry | null {
        return summaries.get(formatDate(date)) ?? null;
    }

    function getCellClasses(date: Date, entry: DiaryEntry | null): string {
        const isCurrent = isSameMonth(date, year, month);
        const today = isToday(date);
        const selected = formatDate(date) === currentDate;
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

<div class="calendar">
    <div class="calendar__header">
        <button
            type="button"
            class="icon-button"
            aria-label="上一月"
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

        <p class="calendar__title">{year}年{month + 1}月</p>

        <div>
            <button
                type="button"
                class="icon-button"
                aria-label="下一月"
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
    </div>

    <div class="calendar__weekdays">
        {#each weekdayLabels as label}
            <span>{label}</span>
        {/each}
    </div>

    <div
        class="calendar-section"
        aria-hidden={calendarExpanded ? "false" : "true"}
        hidden={!calendarExpanded}
    >
        {#each topWeeks as week}
            <div class="calendar__grid">
                {#each week as date (formatDate(date))}
                    {@const entry = getEntry(date)}
                    <button
                        type="button"
                        class={getCellClasses(date, entry)}
                        on:click={() => handleDateClick(date)}
                        aria-pressed={formatDate(date) === currentDate}
                    >
                        <span class="date-cell__value">{date.getDate()}</span>
                        {#if entry?.mood}
                            <span class="date-cell__mood">{entry.mood}</span>
                        {/if}
                        {#if entry && !isToday(date) && formatDate(date) !== currentDate}
                            <span class="entry-dot" aria-hidden="true"></span>
                        {/if}
                    </button>
                {/each}
            </div>
        {/each}
    </div>

    <div class="calendar__grid" aria-live="polite">
        {#each selectedWeek as date (formatDate(date))}
            {@const entry = getEntry(date)}
            <button
                type="button"
                class={getCellClasses(date, entry)}
                aria-current={isToday(date) ? "date" : undefined}
                aria-pressed={formatDate(date) === currentDate}
                on:click={() => handleDateClick(date)}
            >
                <span class="date-cell__value">{date.getDate()}</span>
                {#if entry?.mood}
                    <span class="date-cell__mood">{entry.mood}</span>
                {/if}
                {#if entry && !isToday(date) && formatDate(date) !== currentDate}
                    <span class="entry-dot" aria-hidden="true"></span>
                {/if}
            </button>
        {/each}
    </div>

    <div
        class="calendar-section"
        aria-hidden={calendarExpanded ? "false" : "true"}
        hidden={!calendarExpanded}
    >
        {#each bottomWeeks as week}
            <div class="calendar__grid">
                {#each week as date (formatDate(date))}
                    {@const entry = getEntry(date)}
                    <button
                        type="button"
                        class={getCellClasses(date, entry)}
                        on:click={() => handleDateClick(date)}
                        aria-pressed={formatDate(date) === currentDate}
                    >
                        <span class="date-cell__value">{date.getDate()}</span>
                        {#if entry?.mood}
                            <span class="date-cell__mood">{entry.mood}</span>
                        {/if}
                        {#if entry && !isToday(date) && formatDate(date) !== currentDate}
                            <span class="entry-dot" aria-hidden="true"></span>
                        {/if}
                    </button>
                {/each}
            </div>
        {/each}
    </div>

    <div>
        <button
            type="button"
            class="btn btn--ghost btn--block calendar__toggle"
            on:click={toggleCalendarView}
        >
            {calendarExpanded ? "收起月历" : "展开月历"}
        </button>
    </div>
</div>

<style>
    .calendar {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .calendar__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .calendar__title {
        font-size: 1.2rem;
        font-weight: 600;
        text-align: center;
        flex: 1;
    }

    .calendar__weekdays {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.3rem;
        font-size: 0.8rem;
        text-align: center;
        color: var(--color-text-muted);
    }

    .calendar__grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.35rem;
    }

    .calendar-section {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .calendar-section[hidden] {
        display: none;
    }

    .date-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        border-radius: var(--radius-md);
        border: 1px solid transparent;
        min-height: 68px;
        background: rgba(0, 0, 0, 0.02);
        transition:
            background 140ms ease,
            color 140ms ease,
            border 140ms ease,
            transform 140ms ease;
    }

    .date-cell:hover {
        transform: translateY(-1px);
        border-color: var(--color-border);
    }

    .calendar-cell--muted {
        color: var(--color-text-muted);
    }

    .calendar-cell--selected {
        background: var(--color-accent);
        color: var(--color-text-inverse);
    }

    .calendar-cell--today {
        border-color: var(--color-accent);
    }

    .calendar-cell--has-entry {
        background: var(--color-accent-soft);
        color: var(--color-text);
    }

    .entry-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-success);
    }

    .date-cell__value {
        font-weight: 600;
    }

    .date-cell__mood {
        font-size: 0.75rem;
        color: var(--color-text-muted);
    }

    .calendar__toggle {
        margin-top: 0.35rem;
    }
</style>
