<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  import Calendar from './components/Calendar.svelte';
  import Editor from './components/Editor.svelte';
  import Timeline from './components/Timeline.svelte';
  import { appState, initLayoutListener, initThemeListener, setSummaries } from './utils/state';
  import { listEntriesByMonth } from './utils/backend';

  let isLoadingSummaries = true;
  let loadError: string | null = null;
  let disposeLayout: (() => void) | undefined;
  let disposeTheme: (() => void) | undefined;

  onMount(() => {
    document.documentElement.lang = 'zh-CN';
    disposeTheme = initThemeListener();
    disposeLayout = initLayoutListener();
    void loadInitialSummaries();
  });

  onDestroy(() => {
    disposeLayout?.();
    disposeTheme?.();
  });

  async function loadInitialSummaries(): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    try {
      const summaries = await listEntriesByMonth(year, month);
      setSummaries(summaries);
      loadError = null;
    } catch (error) {
      console.error('加载当月日记摘要失败:', error);
      loadError = '无法加载当月日记摘要，请稍后重试。';
    } finally {
      isLoadingSummaries = false;
    }
  }

  $: layoutMode = $appState.layoutMode;
  $: viewMode = $appState.viewMode;
  $: editorFullscreen = $appState.editorFullscreen;
</script>

<main class="relative min-h-screen overflow-hidden text-(--color-text-primary)">
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(147,51,234,0.14),_transparent_60%)]"></div>
  <div class="relative z-10 flex h-screen flex-col overflow-hidden">
    {#if layoutMode === 'landscape'}
      <div class="flex h-full gap-6 p-6">
        <section class="flex w-[420px] max-w-md flex-col gap-4">
          <Calendar />
          <Timeline />
        </section>
        <section class={`relative flex-1 overflow-hidden rounded-3xl border border-(--color-border-primary) bg-(--color-bg-primary)/80 backdrop-blur-xl shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] transition-[flex-basis] duration-300 ${
          editorFullscreen ? 'flex-[1_1_100%]' : 'flex-[1_1_auto]'
        }`}>
          <Editor />
        </section>
      </div>
    {:else}
      <div class="flex h-full flex-col">
        {#if viewMode === 'home'}
          <div class="flex h-full flex-col gap-4 overflow-hidden p-5" transition:fade>
            <Calendar />
            <Timeline />
          </div>
        {:else}
          <div class="h-full" transition:fade>
            <Editor />
          </div>
        {/if}
      </div>
    {/if}

    {#if loadError}
      <div class="pointer-events-auto fixed left-1/2 top-6 z-30 -translate-x-1/2 rounded-2xl border border-red-400/50 bg-red-500/20 px-4 py-2 text-sm text-red-100 shadow-lg backdrop-blur">
        {loadError}
      </div>
    {/if}

    {#if isLoadingSummaries}
      <div class="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div class="flex items-center gap-3 rounded-3xl border border-(--color-border-secondary) bg-(--color-bg-secondary)/90 px-6 py-4 text-sm shadow-xl">
          <span class="h-3 w-3 animate-ping rounded-full bg-(--color-primary)"></span>
          <span class="tracking-wide text-(--color-text-secondary)">正在加载当月日记...</span>
        </div>
      </div>
    {/if}
  </div>
</main>
