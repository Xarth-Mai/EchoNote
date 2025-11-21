<script lang="ts">
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import { onDestroy, onMount, tick } from "svelte";
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
    import { formatLongDate, locale, t, type Locale } from "$utils/i18n";

    type SaveOptions = {
        dateOverride?: string;
        contentOverride?: string;
        triggerAi?: boolean;
    };

    const state = appStateStore;
    const localeStore = locale;
    let localeValue: Locale = "zh-CN";

    let textareaValue = "";
    let textareaRef: HTMLTextAreaElement | null = null;
    let shouldFocusEditor = true;
    let initialLoadSettled = false;
    let hasHydratedInitialBody = false;
    // 延迟触发的自动保存定时器，避免每次敲击立刻写盘
    let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRenderedDate = "";
    let loadingDate: string | null = null;
    let lastLoadedDate: string | null = null;
    let hasLocalEdits = false;

    $: currentDate = $state.currentDate;
    $: currentBody = $state.currentBody;
    $: localeValue = $localeStore;
    $: dateMeta = buildDateMeta(currentDate, localeValue);
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
        hasHydratedInitialBody = false;
        initialLoadSettled = false;
        setCurrentBody(null);
        shouldFocusEditor = true;
    }
    $: if (currentBody === null && currentDate) {
        void ensureBodyLoaded(currentDate);
    }
    $: if (shouldFocusEditor && initialLoadSettled && textareaRef) {
        shouldFocusEditor = false;
        void focusTextarea();
    }

    async function handleBack(): Promise<void> {
        await flushAutoSave();
        if (!browser) return;
        await goto("/");
    }

    function syncDomValue(): void {
        if (!textareaRef) return;
        const domValue = textareaRef.value;
        if (domValue !== textareaValue) {
            textareaValue = domValue;
            setCurrentBody(domValue);
        }
    }

    function handleInput(): void {
        hasLocalEdits = true;
        syncDomValue();
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

    async function focusTextarea(): Promise<void> {
        if (!browser || !textareaRef) return;
        await tick();
        textareaRef.focus();
        textareaRef.setSelectionRange(
            textareaRef.value.length,
            textareaRef.value.length,
        );
    }

    // 确保切换路由或组件卸载前队列中的自动保存已执行
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

    // 将草稿写入状态后再调用后端保存，保证乐观 UI 不阻塞
    async function save(options: SaveOptions = {}): Promise<void> {
        const { dateOverride, contentOverride, triggerAi = false } = options;
        const targetDate = dateOverride ?? currentDate;
        if (!targetDate) return;

        const body = contentOverride ?? textareaValue;
        const existing = getSummary(targetDate);
        const optimistic: DiaryEntry = existing
            ? { ...existing, date: targetDate }
            : { date: targetDate };
        if (triggerAi) {
            optimistic.aiSummary = t("timelineAiPending");
        }

        setCurrentBody(body);
        upsertSummary(optimistic);
        try {
            const aiConfig =
                body && triggerAi && browser
                    ? await getActiveAiInvokePayload()
                    : null;
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

    // 在切换日期时按需加载正文，防止重复请求同一天的内容
    async function ensureBodyLoaded(
        date: string,
        options: { force?: boolean } = {},
    ): Promise<void> {
        const { force = false } = options;
        if (!browser || !date || loadingDate === date) return;
        const { currentBody: bodyInState } = getState();
        if (!force && lastLoadedDate === date && bodyInState !== null) {
            initialLoadSettled = true;
            return;
        }

        loadingDate = date;
        try {
            syncDomValue();
            const body = await getEntryBody(date);
            lastLoadedDate = date;
            const bodyValue = body ?? "";
            if (!hasHydratedInitialBody) {
                textareaValue = bodyValue;
                setCurrentBody(bodyValue);
                hasHydratedInitialBody = true;
                hasLocalEdits = false;
            } else if (!hasLocalEdits) {
                textareaValue = bodyValue;
                setCurrentBody(bodyValue);
            }
        } catch (error) {
            console.error("加载正文失败:", error);
        } finally {
            initialLoadSettled = true;
            loadingDate = null;
        }
    }

    onMount(() => {
        const initialDate = currentDate || getState().currentDate;
        if (initialDate) {
            void ensureBodyLoaded(initialDate, { force: true });
        }
        shouldFocusEditor = true;
    });

    onDestroy(() => {
        void flushAutoSave();
    });

    function buildDateMeta(
        dateValue?: string | null,
        localeValue?: Locale,
    ): {
        display: string;
        weekday: string;
    } {
        if (!dateValue) {
            return { display: t("editorNoDate"), weekday: "" };
        }
        const { display, weekday } = formatLongDate(dateValue, localeValue);
        return { display, weekday };
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
            aria-label={t("editorBackHome")}
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
            <span>{t("editorComplete")}</span>
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
        placeholder={t("editorPlaceholder")}
        bind:this={textareaRef}
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
