<script lang="ts">
  import { appStateStore, setState } from "$utils/state";
  import { UI } from "$utils/ui";
  import type { DiaryEntry } from "../../types";

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

  $: summaries = $state.summaries;
  $: entries = toSortedEntries(summaries);

  function toSortedEntries(map: Map<string, DiaryEntry>): DiaryEntry[] {
    return Array.from(map.values()).sort((a, b) =>
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

  function formatDateParts(entry: DiaryEntry): {
    dateLabel: string;
    weekday: string;
  } {
    const date = new Date(entry.date);
    const dateLabel = `${date.getMonth() + 1}月${date.getDate()}日`;
    const weekday = weekdayLabels[date.getDay()];
    return { dateLabel, weekday };
  }

  function openEntry(date: string): void {
    setState({ currentDate: date, viewMode: "editor" });
  }
</script>

<div class="timeline h-full flex flex-col">
  <div class="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
    {#if entries.length === 0}
      <div class="p-12 text-center text-(--color-text-secondary)">暂无日记</div>
    {:else}
      {#each entries as entry (entry.date)}
        {@const preview = getPreview(entry.aiSummary)}
        {@const parts = formatDateParts(entry)}
        <button
          type="button"
          class={`entry-item text-left mb-1 p-4 backdrop-blur-md cursor-pointer ${UI.CARD} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)`}
          on:click={() => openEntry(entry.date)}
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-(--color-text-primary)"
                >{parts.dateLabel}</span
              >
              <span class={`text-xs ${UI.MUTED}`}>{parts.weekday}</span>
            </div>
            {#if entry.mood}
              <span class="text-xl" aria-label="今日心情">{entry.mood}</span>
            {/if}
          </div>

          <p class={UI.ENTRY_PREVIEW}>{preview}</p>

          {#if entry.aiSummary}
            <div class={UI.ENTRY_SUMMARY}>
              <span class={UI.ENTRY_SUMMARY_ICON} aria-hidden="true">💡</span>
              {entry.aiSummary}
            </div>
          {/if}
        </button>
      {/each}
    {/if}
  </div>
</div>
