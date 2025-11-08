<script lang="ts">
  import { fade, fly } from 'svelte/transition';

  import type { DiaryEntry } from '../types';
  import { appState, setCurrentDate, setViewMode } from '../utils/state';

  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  $: entries = Array.from($appState.summaries.values()).sort((a, b) => b.date.localeCompare(a.date));
  $: layoutMode = $appState.layoutMode;
  $: currentDate = $appState.currentDate;

  function openEditorFor(date: string): void {
    setCurrentDate(date);
    if (layoutMode === 'portrait') {
      setViewMode('editor');
    }
  }

  function formatDateInfo(entry: DiaryEntry): { label: string; weekday: string } {
    const date = new Date(entry.date);
    const label = `${date.getMonth() + 1}月${date.getDate()}日`;
    const weekday = weekdays[date.getDay()];
    return { label, weekday };
  }

  function preview(content: string | undefined): string {
    if (!content) return '空白日记';
    const plain = content
      .replace(/^#+\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim();
    return plain.length > 120 ? `${plain.slice(0, 120)}…` : plain || '空白日记';
  }

  function formatUpdatedAt(entry: DiaryEntry): string | null {
    if (!entry.updatedAt) return null;
    const date = new Date(entry.updatedAt * 1000);
    return `更新于 ${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  }

  function createTodayEntry(): void {
    const iso = new Date().toISOString().split('T')[0];
    openEditorFor(iso);
  }
</script>

<section class="glow-card flex h-full flex-col overflow-hidden rounded-3xl border border-(--color-border-primary) bg-(--color-bg-primary)/80 backdrop-blur-xl shadow-[0_25px_60px_-40px_rgba(15,23,42,0.55)]">
  <header class="flex items-center justify-between px-5 pb-3 pt-4">
    <div>
      <h3 class="text-base font-semibold tracking-tight">时间线</h3>
      <p class="text-xs text-(--color-text-secondary)">回顾与唤醒每一天的灵感</p>
    </div>
    <button
      class="group flex items-center gap-2 rounded-full bg-(--color-primary) px-4 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
      on:click={createTodayEntry}
    >
      <span class="text-base leading-none">✏️</span>
      <span class="hidden sm:inline">今天写点什么</span>
    </button>
  </header>

  <div class="relative flex-1 overflow-hidden">
    <div class="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-(--color-bg-primary)/85 to-transparent pointer-events-none"></div>
    <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-(--color-bg-primary)/85 to-transparent pointer-events-none"></div>
    <div class="h-full space-y-3 overflow-y-auto px-5 pb-6 pt-2">
      {#if entries.length === 0}
        <div class="flex h-full flex-col items-center justify-center gap-2 text-(--color-text-secondary)" transition:fade>
          <span class="text-4xl">📭</span>
          <p class="text-sm">还没有任何日记，点击右上角开始记录第一条吧！</p>
        </div>
      {:else}
        {#each entries as entry, index (entry.date)}
          {@const meta = formatDateInfo(entry)}
          <button
            type="button"
            class={`group relative w-full overflow-hidden rounded-2xl border border-transparent bg-(--color-bg-secondary)/70 p-4 text-left shadow-sm transition hover:-translate-y-1 hover:border-(--color-primary)/70 hover:shadow-xl ${
              entry.date === currentDate ? 'border-(--color-primary)/80 shadow-lg' : ''
            }`}
            on:click={() => openEditorFor(entry.date)}
            in:fly={{ y: 12, duration: 200 + index * 30 }}
            out:fade={{ duration: 200 }}
          >
            <div class="mb-2 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-(--color-primary-light) text-(--color-primary)">
                  <span class="text-xs font-semibold">{meta.label}</span>
                  <span class="text-[11px] text-(--color-text-secondary)">{meta.weekday}</span>
                </div>
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-2 text-sm font-medium text-(--color-text-primary)">
                    {#if entry.mood}
                      <span class="text-lg leading-none">{entry.mood}</span>
                    {/if}
                    <span>{entry.language ?? '默认语言'}</span>
                  </div>
                  {#if formatUpdatedAt(entry)}
                    <span class="text-[11px] uppercase tracking-wider text-(--color-text-secondary)">{formatUpdatedAt(entry)}</span>
                  {/if}
                </div>
              </div>
              <svg class="h-4 w-4 text-(--color-text-secondary) transition group-hover:translate-x-1 group-hover:text-(--color-primary)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>

            <p class="line-clamp-3 text-sm leading-relaxed text-(--color-text-primary)">{preview(entry.aiSummary)}</p>

            {#if entry.aiSummary}
              <div class="mt-3 rounded-2xl border border-(--color-primary)/40 bg-(--color-primary-light) px-4 py-2 text-xs text-(--color-text-primary)/80 shadow-inner">
                <span class="mr-2 text-(--color-primary)">💡</span>
                {entry.aiSummary}
              </div>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  </div>
</section>
