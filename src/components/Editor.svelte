<script lang="ts">
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  import type { DiaryEntry } from '../types';
  import { getEntryBody, saveEntryByDate } from '../utils/backend';
  import {
    appState,
    getSummary,
    setCurrentBody,
    setViewMode,
    toggleEditorFullscreen,
    upsertSummary,
  } from '../utils/state';

  let textValue = '';
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let savedHintTimer: ReturnType<typeof setTimeout> | null = null;
  let lastRenderedDate = '';
  let lastLoadedDate: string | null = null;
  let shouldSyncFromStore = true;
  let isSaving = false;
  let showSavedHint = false;
  let loadError: string | null = null;
  let isBodyLoading = false;

  $: currentDate = $appState.currentDate;
  $: layoutMode = $appState.layoutMode;
  $: editorFullscreen = $appState.editorFullscreen;
  $: bodyFromStore = $appState.currentBody ?? '';

  $: if (shouldSyncFromStore) {
    textValue = bodyFromStore;
    shouldSyncFromStore = false;
  }

  $: if (currentDate && currentDate !== lastRenderedDate) {
    flushAutoSave();
    lastRenderedDate = currentDate;
    shouldSyncFromStore = true;
    textValue = '';
    loadError = null;
    void ensureBodyLoaded(currentDate);
  }

  onMount(() => {
    const state = get(appState);
    lastRenderedDate = state.currentDate;
    textValue = state.currentBody ?? '';
    shouldSyncFromStore = true;
    void ensureBodyLoaded(state.currentDate);

    return () => cleanup();
  });

  function handleInput(): void {
    shouldSyncFromStore = false;
    scheduleAutoSave();
  }

  function scheduleAutoSave(): void {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    autoSaveTimer = window.setTimeout(() => {
      flushAutoSave();
    }, 5000);
  }

  function flushAutoSave(): void {
    if (!lastRenderedDate) return;
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    void persistDraft(lastRenderedDate, textValue);
  }

  async function persistDraft(date: string, body: string): Promise<void> {
    const existing = (getSummary(date) ?? { date }) as DiaryEntry;
    const state = get(appState);
    const currentSummary = state.summaries.get(date);
    if (currentSummary && state.currentBody === body && currentSummary.updatedAt === existing.updatedAt) {
      showSavedToast();
      return;
    }

    const summary: DiaryEntry = { ...existing, updatedAt: Math.floor(Date.now() / 1000) };

    setCurrentBody(body);
    upsertSummary(summary);

    isSaving = true;
    try {
      await saveEntryByDate(summary, body);
      showSavedToast();
    } catch (error) {
      console.error('保存日记失败:', error);
      loadError = '保存失败，请稍后重试';
    } finally {
      isSaving = false;
    }
  }

  function showSavedToast(): void {
    if (savedHintTimer) {
      clearTimeout(savedHintTimer);
    }
    showSavedHint = true;
    savedHintTimer = window.setTimeout(() => {
      showSavedHint = false;
    }, 2000);
  }

  async function ensureBodyLoaded(date: string): Promise<void> {
    if (!date) return;
    if (lastLoadedDate === date && get(appState).currentBody !== null) return;

    isBodyLoading = true;
    loadError = null;
    try {
      const body = await getEntryBody(date);
      setCurrentBody(body ?? '');
      shouldSyncFromStore = true;
      lastLoadedDate = date;
    } catch (error) {
      console.error('获取日记正文失败:', error);
      loadError = '加载正文失败';
      setCurrentBody('');
    } finally {
      isBodyLoading = false;
    }
  }

  function handleBack(): void {
    setViewMode('home');
  }

  function handleToggleFullscreen(): void {
    toggleEditorFullscreen();
  }

  $: toolbarTitle = currentDate || '未选择日期';

  function handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      cleanup();
    }
  }

  function cleanup(): void {
    flushAutoSave();
    if (savedHintTimer) {
      clearTimeout(savedHintTimer);
      savedHintTimer = null;
    }
  }

  $: currentLength = textValue.length;
</script>

<svelte:window on:beforeunload={cleanup} on:visibilitychange={handleVisibilityChange} />

<div class="flex h-full flex-col" transition:fade>
  <header class="flex items-center justify-between gap-3 border-b border-(--color-border-primary) bg-(--color-bg-secondary)/80 px-6 py-4 backdrop-blur">
    <div class="flex items-center gap-2">
      {#if layoutMode === 'portrait'}
        <button
          class="flex items-center gap-2 rounded-full border border-(--color-border-secondary) bg-transparent px-3 py-1.5 text-xs font-medium text-(--color-text-secondary) transition hover:border-(--color-primary) hover:text-(--color-primary)"
          on:click={handleBack}
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span>返回</span>
        </button>
      {:else}
        <button
          class="flex items-center gap-2 rounded-full border border-(--color-border-secondary) bg-transparent px-3 py-1.5 text-xs font-medium text-(--color-text-secondary) transition hover:border-(--color-primary) hover:text-(--color-primary)"
          on:click={handleToggleFullscreen}
        >
          {#if editorFullscreen}
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 9h2V6h3V4H4v5zm13-5v2h3v3h2V4h-5zm3 11h-3v2h-3v2h6v-4zm-11 4v-2H6v-3H4v5h5z" />
            </svg>
            <span>退出全屏</span>
          {:else}
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4H4v5h2V6h3V4zm11 0h-5v2h3v3h2V4zM4 20h5v-2H6v-3H4v5zm13-5v3h-3v2h5v-5h-2z" />
            </svg>
            <span>全屏编辑</span>
          {/if}
        </button>
      {/if}
    </div>

    <div class="text-center">
      <h2 class="text-base font-semibold tracking-tight">{toolbarTitle}</h2>
      <p class="text-[11px] uppercase tracking-widest text-(--color-text-secondary)">字数 {currentLength}</p>
    </div>

    <div class="flex items-center gap-3 text-xs text-(--color-text-secondary)">
      {#if isBodyLoading}
        <div class="flex items-center gap-2 rounded-full border border-(--color-border-secondary) bg-(--color-bg-secondary)/70 px-3 py-1">
          <span class="h-2 w-2 animate-ping rounded-full bg-(--color-primary)"></span>
          <span>加载中</span>
        </div>
      {:else if isSaving}
        <div class="flex items-center gap-2 rounded-full border border-(--color-border-secondary) bg-(--color-bg-secondary)/70 px-3 py-1">
          <span class="h-2 w-2 animate-pulse rounded-full bg-(--color-primary)"></span>
          <span>保存中</span>
        </div>
      {:else if showSavedHint}
        <div class="flex items-center gap-2 rounded-full border border-(--color-border-secondary) bg-(--color-primary-light) px-3 py-1 text-(--color-primary)">
          <span class="text-sm">✅</span>
          <span>已保存</span>
        </div>
      {:else}
        <div class="flex items-center gap-2 rounded-full border border-(--color-border-secondary) bg-transparent px-3 py-1">
          <span class="h-2 w-2 rounded-full bg-(--color-success)"></span>
          <span>自动保存开启</span>
        </div>
      {/if}
    </div>
  </header>

  <div class="relative flex-1">
    <textarea
      class="h-full w-full resize-none bg-transparent px-6 py-5 text-base leading-relaxed text-(--color-text-primary) outline-none"
      placeholder="记录今天的灵感..."
      bind:value={textValue}
      on:input={handleInput}
    ></textarea>

    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(217,70,239,0.08),_transparent_55%)] opacity-70"></div>
  </div>

  {#if loadError}
    <div class="pointer-events-auto absolute bottom-6 right-6 z-20 rounded-2xl border border-red-400/60 bg-red-500/20 px-4 py-2 text-xs text-red-100 shadow-lg backdrop-blur">
      {loadError}
    </div>
  {/if}
</div>

<style>
  textarea::selection {
    background: color-mix(in srgb, var(--color-primary) 30%, transparent);
  }
</style>
