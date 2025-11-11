<script lang="ts">
    import { tick } from "svelte";
    import { flyAndBlur } from "$utils/animation";
    import { appStateStore, setCurrentDate } from "$utils/state";
    import type { DiaryEntry } from "../../types";

    type TimelineEntry = DiaryEntry & { __placeholder?: boolean };

    const state = appStateStore;
    const weekdayLabels = [
        "周日",
        "周一",
        "周二",
        "周三",
        "周四",
        "周五",
        "周六",
    ];

    const entryRefs = new Map<string, HTMLLIElement>();
    let pendingScrollDate: string | null = null;

    $: summaries = $state.summaries;
    $: entries = toSortedEntries(summaries);
    $: currentDate = $state.currentDate;
    $: displayEntries = deriveEntries(entries, currentDate);
    $: if (currentDate) {
        pendingScrollDate = currentDate;
    }
    $: if (pendingScrollDate && displayEntries) {
        void scrollToEntry(pendingScrollDate);
    }

    function toSortedEntries(map: Map<string, DiaryEntry>): TimelineEntry[] {
        return Array.from(map.values()).sort((a, b) =>
            b.date.localeCompare(a.date),
        );
    }

    function deriveEntries(
        source: TimelineEntry[],
        targetDate?: string | null,
    ): TimelineEntry[] {
        if (!targetDate) return source;
        const exists = source.some((entry) => entry.date === targetDate);
        if (exists) return source;
        return injectPlaceholder(source, targetDate);
    }

    function injectPlaceholder(
        source: TimelineEntry[],
        targetDate: string,
    ): TimelineEntry[] {
        const placeholder: TimelineEntry = {
            date: targetDate,
            __placeholder: true,
        };
        return [...source, placeholder].sort((a, b) =>
            b.date.localeCompare(a.date),
        );
    }

    function getPreview(content: string | null | undefined): string {
        if (!content) return "空白日记";
        const plain = content
            .replace(/^#+\s+/gm, "")
            .replace(/\*\*(.+?)\*\*/g, "$1")
            .replace(/\*(.+?)\*/g, "$1")
            .replace(/`(.+?)`/g, "$1")
            .replace(/\[(.+?)\]\(.+?\)/g, "$1")
            .trim();

        return plain.length > 100 ? `${plain.slice(0, 100)}...` : plain;
    }

    function formatDateParts(entry: TimelineEntry): {
        dateLabel: string;
        weekday: string;
    } {
        const date = new Date(entry.date);
        const dateLabel = `${date.getMonth() + 1}月${date.getDate()}日`;
        const weekday = weekdayLabels[date.getDay()];
        return { dateLabel, weekday };
    }

    function selectEntry(date: string): void {
        setCurrentDate(date);
    }

    function trackEntry(node: HTMLLIElement, date: string) {
        entryRefs.set(date, node);
        return {
            destroy() {
                entryRefs.delete(date);
            },
        };
    }

    async function scrollToEntry(date: string): Promise<void> {
        await tick();
        const target = entryRefs.get(date);
        if (!target) return;
        const container = target.closest<HTMLElement>(".timeline__list");
        if (container) {
            const containerRect = container.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const targetOffset =
                targetRect.top - containerRect.top + container.scrollTop;
            const idealScroll =
                targetOffset -
                container.clientHeight / 2 +
                target.clientHeight / 2;
            const clampedScroll = Math.max(
                0,
                Math.min(
                    idealScroll,
                    container.scrollHeight - container.clientHeight,
                ),
            );
            container.scrollTo({ top: clampedScroll, behavior: "smooth" });
        } else {
            target.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        pendingScrollDate = null;
    }
</script>

<div class="timeline">
    {#if displayEntries.length === 0}
        <div class="timeline__empty">暂无日记</div>
    {:else}
        <ul class="timeline__list">
            {#each displayEntries as entry, index (entry.date)}
                {@const preview = getPreview(entry.aiSummary)}
                {@const parts = formatDateParts(entry)}
                <li
                    class="timeline__item"
                    class:timeline__item--active={entry.date === currentDate}
                    use:trackEntry={entry.date}
                    in:flyAndBlur={{ y: 45, duration: 420, delay: index * 70 }}
                >
                    <div class="timeline__axis">
                        <span
                            class="timeline__dot"
                            class:timeline__dot--active={entry.date ===
                                currentDate}
                        ></span>
                        <p>{parts.dateLabel}</p>
                        <small>{parts.weekday}</small>
                    </div>
                    <button
                        type="button"
                        class="timeline__card"
                        class:timeline__card--active={entry.date ===
                            currentDate}
                        class:timeline__card--placeholder={entry.__placeholder}
                        aria-pressed={entry.date === currentDate}
                        on:click={() => selectEntry(entry.date)}
                    >
                        {#if entry.__placeholder}
                            <div class="timeline__placeholder">
                                <p>当日暂无内容</p>
                                <small>点击“去编辑”开始记录</small>
                            </div>
                        {:else}
                            <div class="timeline__card-title">
                                <p>记录概览</p>
                                {#if entry.mood}
                                    <span
                                        class="timeline__mood"
                                        aria-label="心情状态">{entry.mood}</span
                                    >
                                {/if}
                            </div>
                            <p class="timeline__preview">{preview}</p>
                            {#if entry.aiSummary}
                                <p class="timeline__summary">
                                    <span aria-hidden="true">💡</span>
                                    {entry.aiSummary}
                                </p>
                            {/if}
                        {/if}
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .timeline {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-height: 320px;
    }

    .timeline__empty {
        text-align: center;
        color: var(--color-text-muted);
        padding: 3rem 1rem;
    }

    .timeline__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 1.2rem;
        max-height: 520px;
        overflow-y: auto;
    }

    .timeline__item {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 1rem;
        align-items: center;
    }

    @media (max-width: 720px) {
        .timeline__item {
            grid-template-columns: 1fr;
        }
    }

    .timeline__axis {
        position: relative;
        padding-left: 1.8rem;
        color: var(--color-text-muted);
        font-size: 0.9rem;
    }

    .timeline__axis::after {
        content: "";
        position: absolute;
        left: 0.4rem;
        right: 0;
        top: 0.9rem;
        height: 2px;
        background: linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.08),
            rgba(37, 99, 235, 0.45)
        );
    }

    .timeline__dot {
        position: absolute;
        top: 0.5rem;
        left: 0;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 3px solid var(--color-accent);
        background: var(--color-bg-panel);
    }

    .timeline__dot--active {
        background: var(--color-accent);
    }

    .timeline__card {
        width: 100%;
        text-align: left;
        border-radius: var(--radius-md);
        border: 1px solid var(--color-border);
        padding: 1rem;
        background: var(--color-bg-panel);
        box-shadow: var(--shadow-card);
        transition: border 150ms ease, transform 150ms ease;
    }

    .timeline__card:hover {
        transform: translateY(-2px);
    }

    .timeline__card--active {
        border-color: var(--color-accent);
    }

    .timeline__card--placeholder {
        border-style: dashed;
        text-align: center;
        color: var(--color-text-muted);
    }

    .timeline__card-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.6rem;
        font-weight: 600;
    }

    .timeline__mood {
        font-size: 1.5rem;
    }

    .timeline__preview {
        font-size: 0.95rem;
        line-height: 1.5;
        color: var(--color-text);
        opacity: 0.85;
    }

    .timeline__summary {
        margin-top: 0.6rem;
        display: inline-flex;
        gap: 0.3rem;
        align-items: center;
        border-radius: var(--radius-sm);
        border: 1px solid var(--color-border);
        padding: 0.35rem 0.7rem;
        font-size: 0.85rem;
        background: var(--color-accent-soft);
    }
</style>
