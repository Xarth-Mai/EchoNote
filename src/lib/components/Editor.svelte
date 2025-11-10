<script lang="ts">
    import { onDestroy } from "svelte";
    import { getEntryBody, saveEntryByDate } from "$utils/backend";
    import {
        appStateStore,
        getSummary,
        getState,
        setCurrentBody,
        setViewMode,
        toggleEditorFullscreen,
        upsertSummary,
    } from "$utils/state";
    import { cx, UI } from "$utils/ui";
    import type { DiaryEntry } from "../../types";

    const state = appStateStore;

    let textareaValue = "";
    let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRenderedDate = "";
    let loadingDate: string | null = null;
    let lastLoadedDate: string | null = null;

    $: currentDate = $state.currentDate;
    $: layoutMode = $state.layoutMode;
    $: editorFullscreen = $state.editorFullscreen;
    $: currentBody = $state.currentBody;
    $: isLandscape = layoutMode === "landscape";

    $: if (!lastRenderedDate && currentDate) {
        lastRenderedDate = currentDate;
    }

    $: if (currentDate && currentDate !== lastRenderedDate) {
        flushAutoSave();
        lastRenderedDate = currentDate;
        setCurrentBody(null);
    }

    $: if (currentBody !== null && currentBody !== textareaValue) {
        textareaValue = currentBody;
    } else if (currentBody === null && textareaValue !== "") {
        textareaValue = "";
    }

    $: if (currentBody === null && currentDate) {
        void ensureBodyLoaded(currentDate);
    }

    function handleBack(): void {
        setViewMode("home");
    }

    function handleToggleFullscreen(): void {
        toggleEditorFullscreen();
    }

    function handleInput(): void {
        setCurrentBody(textareaValue);
        scheduleAutoSave();
    }

    function scheduleAutoSave(): void {
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
        }
        if (typeof window === "undefined") return;

        autoSaveTimer = window.setTimeout(() => {
            autoSaveTimer = null;
            void save();
        }, 10000);
    }

    function flushAutoSave(): void {
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = null;
            const targetDate = lastRenderedDate || currentDate;
            if (targetDate) {
                void save(targetDate, textareaValue);
            }
        }
    }

    async function save(
        dateOverride?: string,
        contentOverride?: string,
    ): Promise<void> {
        const targetDate = dateOverride ?? currentDate;
        if (!targetDate) return;

        const body = contentOverride ?? textareaValue;
        const existing = (getSummary(targetDate) ?? {
            date: targetDate,
        }) as DiaryEntry;
        const summary: DiaryEntry = {
            ...existing,
            updatedAt: Math.floor(Date.now() / 1000),
        };

        setCurrentBody(body);
        upsertSummary(summary);
        try {
            await saveEntryByDate(summary, body);
        } catch (error) {
            console.error("保存日记失败:", error);
        }
    }

    async function ensureBodyLoaded(date: string): Promise<void> {
        if (!date || loadingDate === date) return;
        const { currentBody: bodyInState } = getState();
        if (lastLoadedDate === date && bodyInState !== null) return;

        loadingDate = date;
        try {
            const body = await getEntryBody(date);
            lastLoadedDate = date;
            setCurrentBody(body ?? "");
        } catch (error) {
            console.error("加载正文失败:", error);
        } finally {
            loadingDate = null;
        }
    }

    onDestroy(() => {
        flushAutoSave();
    });
</script>

<div class="editor h-full flex flex-col">
    <div
        class="flex items-center justify-between px-5 py-3 border-b backdrop-blur-md border-(--color-border-primary) bg-(--color-bg-tertiary)"
    >
        {#if isLandscape}
            <button
                type="button"
                class={UI.BTN_GHOST}
                on:click={handleToggleFullscreen}
            >
                {#if editorFullscreen}
                    ⊟ 分屏
                {:else}
                    ⊡ 全屏
                {/if}
            </button>
        {:else}
            <button
                type="button"
                class={cx(UI.BTN_GHOST, "flex items-center gap-1")}
                on:click={handleBack}
                aria-label="返回主页"
            >
                <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 19l-7-7 7-7"
                    />
                </svg>
                <span>主页</span>
            </button>
        {/if}

        <h2
            class="text-base font-semibold tracking-tight text-(--color-text-primary)"
        >
            {currentDate}
        </h2>

        <div
            class="flex items-center gap-2 text-xs text-(--color-text-secondary)"
        >
            <div
                class="w-2 h-2 rounded-full animate-pulse bg-(--color-success)"
            ></div>
            <span>自动保存</span>
        </div>
    </div>

    <textarea
        class="flex-1 px-6 py-5 resize-none outline-none bg-transparent text-base leading-relaxed text-(--color-text-primary)"
        placeholder="开始写作..."
        bind:value={textareaValue}
        on:input={handleInput}
    ></textarea>
</div>
