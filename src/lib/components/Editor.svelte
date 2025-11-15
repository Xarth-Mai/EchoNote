<script lang="ts">
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import { onDestroy, onMount } from "svelte";
    import {
        getEntryBody,
        listEntriesByMonth,
        saveEntryByDate,
    } from "$utils/backend";
    import { getActiveAiInvokePayload } from "$utils/ai";
    import {
        appStateStore,
        getSummary,
        getState,
        setSummaries,
        setCurrentBody,
        upsertSummary,
    } from "$utils/state";
    import type { DiaryEntry } from "../../types";

    type SaveOptions = {
        dateOverride?: string;
        contentOverride?: string;
        triggerAi?: boolean;
    };

    const state = appStateStore;

    let textareaValue = "";
    let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRenderedDate = "";
    let loadingDate: string | null = null;
    let lastLoadedDate: string | null = null;
    let hasLocalEdits = false;

    $: currentDate = $state.currentDate;
    $: currentBody = $state.currentBody;
    $: dateMeta = buildDateMeta(currentDate);
    $: if (
        !hasLocalEdits &&
        currentBody !== null &&
        textareaValue !== currentBody
    ) {
        textareaValue = currentBody;
    }

    $: if (!lastRenderedDate && currentDate) {
        lastRenderedDate = currentDate;
    }

    $: if (currentDate && currentDate !== lastRenderedDate) {
        void flushAutoSave();
        lastRenderedDate = currentDate;
        textareaValue = "";
        hasLocalEdits = false;
        lastLoadedDate = null;
        setCurrentBody(null);
    }
    $: if (currentBody === null && currentDate) {
        void ensureBodyLoaded(currentDate);
    }

    async function handleBack(): Promise<void> {
        await flushAutoSave();
        if (!browser) return;
        await goto("/");
    }

    function handleInput(): void {
        hasLocalEdits = true;
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

    async function flushAutoSave(triggerAi = true): Promise<void> {
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = null;
            const targetDate = lastRenderedDate || currentDate;
            if (targetDate) {
                await save({
                    dateOverride: targetDate,
                    contentOverride: textareaValue,
                    triggerAi,
                });
                return;
            }
        }
        if (hasLocalEdits) {
            await save({ triggerAi });
        }
    }

    async function save(options: SaveOptions = {}): Promise<void> {
        const {
            dateOverride,
            contentOverride,
            triggerAi = false,
        } = options;
        const targetDate = dateOverride ?? currentDate;
        if (!targetDate) return;

        const body = contentOverride ?? textareaValue;
        const existing = getSummary(targetDate);
        const optimistic: DiaryEntry = existing
            ? { ...existing, date: targetDate }
            : { date: targetDate };
        if (triggerAi) {
            optimistic.aiSummary = "AI 摘要生成中...";
        }

        setCurrentBody(body);
        upsertSummary(optimistic);
        try {
            const aiConfig =
                triggerAi && browser ? await getActiveAiInvokePayload() : null;
            const savedSummary = await saveEntryByDate(
                targetDate,
                body,
                aiConfig,
            );
            upsertSummary(savedSummary);
            await refreshMonthSummaries(targetDate);
        } catch (error) {
            console.error("保存日记失败:", error);
        }
    }

    async function ensureBodyLoaded(
        date: string,
        options: { force?: boolean } = {},
    ): Promise<void> {
        const { force = false } = options;
        if (!browser || !date || loadingDate === date) return;
        const { currentBody: bodyInState } = getState();
        if (!force && lastLoadedDate === date && bodyInState !== null) return;

        loadingDate = date;
        try {
            const body = await getEntryBody(date);
            lastLoadedDate = date;
            const bodyValue = body ?? "";
            if (!hasLocalEdits) {
                textareaValue = bodyValue;
                setCurrentBody(bodyValue);
            }
        } catch (error) {
            console.error("加载正文失败:", error);
        } finally {
            loadingDate = null;
        }
    }

    onMount(() => {
        const initialDate = currentDate || getState().currentDate;
        if (initialDate) {
            void ensureBodyLoaded(initialDate, { force: true });
        }
    });

    onDestroy(() => {
        void flushAutoSave();
    });

    function buildDateMeta(dateValue?: string | null): {
        display: string;
        weekday: string;
    } {
        if (!dateValue) {
            return { display: "未选择日期", weekday: "" };
        }
        const date = new Date(dateValue);
        const weekdayLabels = [
            "周日",
            "周一",
            "周二",
            "周三",
            "周四",
            "周五",
            "周六",
        ];
        return {
            display: `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`,
            weekday: weekdayLabels[date.getDay()],
        };
    }

    async function refreshMonthSummaries(date: string): Promise<void> {
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return;
        const year = parsed.getFullYear();
        const month = parsed.getMonth() + 1;
        try {
            const summaries = await listEntriesByMonth(year, month);
            setSummaries(summaries);
        } catch (error) {
            console.error("刷新月度摘要失败:", error);
        }
    }
</script>

<div class="editor-shell surface-card surface-card--shadow">
    <div class="editor-shell__toolbar">
        <button
            type="button"
            class="btn btn--ghost btn--compact"
            on:click={handleBack}
            aria-label="返回主页"
        >
            <svg
                fill="none"
                width="16"
                height="16"
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
            <span>完成</span>
        </button>

        <p class="editor-shell__date">
            {dateMeta.display}
            {#if dateMeta.weekday}
                <span class="editor-shell__weekday">· {dateMeta.weekday}</span>
            {/if}
        </p>
    </div>

    <textarea
        class="editor-shell__textarea"
        placeholder="记录你的灵感、片刻与感悟..."
        bind:value={textareaValue}
        on:input={handleInput}
    ></textarea>
</div>

<style>
    .editor-shell {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        height: 100%;
    }

    .editor-shell__toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }

    .editor-shell__date {
        font-weight: 600;
    }

    .editor-shell__weekday {
        color: var(--color-text-muted);
        padding-right: 0.75rem;
    }

    .editor-shell__textarea {
        width: 100%;
        flex: 1;
        min-height: clamp(420px, 65vh, 960px);
        border: none;
        border-radius: var(--radius-md);
        padding: clamp(1rem, 2vw, 1.5rem);
        font: inherit;
        font-size: medium;
        line-height: 1.6;
        resize: none;
        background: transparent;
        color: inherit;
    }

    .editor-shell__textarea:focus {
        outline: none;
    }
</style>
