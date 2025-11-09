<script lang="ts">
  import { onMount } from 'svelte';
  import CalendarHost from '$lib/wrappers/CalendarHost.svelte';
  import EditorHost from '$lib/wrappers/EditorHost.svelte';
  import TimelineHost from '$lib/wrappers/TimelineHost.svelte';
  import {
    appStateStore,
    initLayoutListener,
    initThemeListener,
    setCalendarExpanded,
    setSummaries
  } from '../utils/state';
  import { listEntriesByMonth } from '../utils/backend';

  const state = appStateStore;

  onMount(() => {
    initThemeListener();
    initLayoutListener();

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    void listEntriesByMonth(year, month)
      .then((summaries) => {
        setSummaries(summaries);
      })
      .catch((err) => {
        console.error('加载当月日记摘要失败:', err);
      });
  });

  $: layoutMode = $state.layoutMode;
  $: viewMode = $state.viewMode;
  $: editorFullscreen = $state.editorFullscreen;
  $: calendarExpanded = $state.calendarExpanded;

  $: appClasses = ['h-full', layoutMode === 'landscape' ? 'flex' : ''].join(' ').trim();
  $: homePanelClasses = [
    'h-full',
    'flex',
    'flex-col',
    layoutMode === 'portrait' && viewMode === 'editor' ? 'hidden' : '',
    layoutMode === 'landscape' && editorFullscreen ? 'hidden' : '',
    layoutMode === 'landscape' && !editorFullscreen ? 'w-21/55 border-r border-(--color-border-primary)' : ''
  ]
    .join(' ')
    .trim();
  $: editorPanelClasses = [
    'h-full',
    layoutMode === 'portrait' && viewMode === 'home' ? 'hidden' : '',
    layoutMode === 'landscape' ? 'flex-1' : '',
    layoutMode === 'landscape' && editorFullscreen ? 'flex-1' : ''
  ]
    .join(' ')
    .trim();

  $: toggleLabel = calendarExpanded ? '收起日历' : '展开日历';
  $: toggleIcon = calendarExpanded ? '▲' : '▼';
</script>

<svelte:head>
  <title>EchoNote</title>
</svelte:head>

<div class={appClasses}>
  <div class={homePanelClasses}>
    <div class="shrink-0 p-5 backdrop-blur-sm bg-(--color-bg-secondary)">
      <CalendarHost />
    </div>

    <div class="shrink-0 flex justify-center py-3 border-y backdrop-blur-sm border-(--color-border-primary) bg-(--color-bg-secondary)">
      <button
        class="flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 text-(--color-primary) hover:bg-(--color-primary-hover)"
        on:click={() => setCalendarExpanded(!calendarExpanded)}
        aria-pressed={calendarExpanded}
      >
        <span class="text-xs">{toggleIcon}</span>
        <span>{toggleLabel}</span>
      </button>
    </div>

    <div class="flex-1 overflow-hidden">
      <TimelineHost />
    </div>
  </div>

  <div class={editorPanelClasses}>
    <EditorHost />
  </div>
</div>
