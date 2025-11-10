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
