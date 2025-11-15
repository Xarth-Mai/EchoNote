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

    function getSummary(content: string | null | undefined): string {
        if (!content) return "AI 摘要生成中...";
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

    function getEmojiSymbol(emoji?: string | null): string {
        const trimmed = emoji?.trim();
        return trimmed ? trimmed : "🤔";
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
        <ul class="timeline__list scroll-fade">
            {#each displayEntries as entry, index (entry.date)}
                {@const preview = getSummary(entry.aiSummary)}
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
                                <small>点击顶部按钮开始记录</small>
                            </div>
                        {:else}
                            <p class="timeline__summary-line">
                                <span
                                    class="timeline__emoji"
                                    aria-label="每日Emoji"
                                    >{getEmojiSymbol(entry.emoji)}</span
                                >
                                <span class="timeline__summary-text">
                                    {preview}</span
                                >
                            </p>
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
        flex: 1 1 320px;
        min-height: 0;
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
        gap: 0.85rem;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding-top: 1rem;
        padding-right: 0.5rem;
        scrollbar-width: none;
    }

    .timeline__list::-webkit-scrollbar {
        display: none;
    }

    .timeline__item {
        --timeline-gap: clamp(0.6rem, 1.6vw, 1rem);
        display: grid;
        grid-template-columns: minmax(84px, 0.35fr) minmax(0, 1fr);
        gap: var(--timeline-gap);
        align-items: stretch;
    }

    .timeline__axis {
        position: relative;
        padding-left: 1.6rem;
        color: var(--color-text-muted);
        font-size: 0.9rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.2rem;
        min-height: 100%;
        z-index: 1;
    }

    .timeline__axis::after {
        content: "";
        position: absolute;
        left: 0.4rem;
        right: calc(-1 * (var(--timeline-gap) + 0.6rem));
        top: 50%;
        transform: translateY(-50%);
        height: 2px;
        background: linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.08),
            rgba(37, 99, 235, 0.45)
        );
        opacity: 0.9;
        pointer-events: none;
        z-index: -1;
    }

    .timeline__dot {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        left: 0;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 3px solid var(--color-accent);
        background: var(--color-accent);
    }

    .timeline__dot::after {
        content: "";
        position: absolute;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-bg-panel-dark);
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.4);
        opacity: 0;
        transition:
            opacity 150ms ease,
            transform 150ms ease;
    }

    .timeline__dot--active::after {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }

    .timeline__card {
        width: 100%;
        text-align: left;
        border-radius: var(--radius-md);
        border: 1px solid var(--color-border);
        padding: 0.85rem 0.95rem;
        background: var(--color-bg-panel);
        position: relative;
        z-index: 1;
        transition:
            border 150ms ease,
            transform 150ms ease;
    }

    .timeline__card--active {
        border-color: var(--color-accent);
    }

    .timeline__card--placeholder {
        border-style: dashed;
        text-align: center;
        color: var(--color-text-muted);
    }

    .timeline__summary-line {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.55rem;
        font-size: 0.9rem;
        line-height: 1.4;
    }

    .timeline__summary-text {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
    }

    .timeline__emoji {
        font-size: 1.5rem;
        line-height: 1;
    }
</style>
