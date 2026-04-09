<script lang="ts">
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import { onDestroy, onMount, tick } from "svelte";
    import { EditorView, basicSetup } from "codemirror";
    import { EditorState } from "@codemirror/state";
    import { markdown } from "@codemirror/lang-markdown";
    import { keymap } from "@codemirror/view";
    import { defaultKeymap } from "@codemirror/commands";
    import {
        getEntryBody,
        listEntriesByMonth,
        saveEntryByDate,
    } from "$utils/backend";
    import { getActiveAiInvokePayload } from "$utils/ai";
    import { ghostTextPlugin, ghostTextState, ghostTextKeymap } from "./editor/ghostText";
    import { grammarCheckPlugin, grammarState, grammarTooltip } from "./editor/grammarCheck";
    import AiFloatingMenu from "./editor/AiFloatingMenu.svelte";
    import { invokeAiRewrite } from "$utils/backend";
    import {
        appStateStore,
        getSummary,
        getState,
        setSummaries,
        setCurrentBody,
        upsertSummary,
    } from "$utils/state";
    import type { DiaryEntry } from "../../types";
    import { formatLongDate, locale, translator, type Locale } from "$utils/i18n";

    type SaveOptions = {
        dateOverride?: string | null;
        contentOverride?: string;
        triggerAi?: boolean;
    };

    const AUTO_SAVE_DELAY = 10000;

    const state = appStateStore;
    const localeStore = locale;
    const t = translator;
    let localeValue: Locale = "zh-Hans";

    let textareaValue = "";
    let editorContainer: HTMLDivElement | null = null;
    let editorView: EditorView | null = null;
    let ignoreNextUpdate = false;
    let shouldFocusEditor = true;
    let initialLoadSettled = false;
    let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingStateSync = 0;
    let activeDate: string | null = getState().currentDate;
    let loadingDate: string | null = null;
    let loadedDate: string | null = null;
    let hasDirtyEdits = false;

    let aiSelection: { text: string; from: number; to: number } | null = null;
    let aiSelectionRect: { top: number; left: number; bottom: number; right: number } | null = null;

    $: currentDate = $state.currentDate;
    $: currentBody = $state.currentBody;
    $: localeValue = $localeStore;
    $: dateMeta = buildDateMeta(currentDate, localeValue);

    $: if (
        !hasDirtyEdits &&
        currentBody !== null &&
        textareaValue !== currentBody
    ) {
        applyTextareaValue(currentBody, { markPristine: true });
    }

    $: if (currentDate && currentDate !== activeDate) {
        void handleDateChange(currentDate);
    }

    $: if (activeDate && currentBody === null) {
        void ensureBodyLoaded(activeDate);
    }

    $: if (shouldFocusEditor && initialLoadSettled && editorView) {
        shouldFocusEditor = false;
        void focusTextarea();
    }

    onMount(() => {
        if (editorContainer) {
            editorView = new EditorView({
                parent: editorContainer,
                state: EditorState.create({
                    doc: textareaValue,
                    extensions: [
                        basicSetup,
                        markdown(),
                        EditorView.lineWrapping,
                        keymap.of(defaultKeymap),
                        ghostTextState,
                        ghostTextPlugin,
                        ghostTextKeymap,
                        grammarState,
                        grammarCheckPlugin,
                        grammarTooltip,
                        EditorView.updateListener.of((update) => {
                            if (update.docChanged && !ignoreNextUpdate) {
                                textareaValue = update.state.doc.toString();
                                handleInput();
                            }
                            if (update.selectionSet) {
                                handleSelectionUpdate(update.view);
                            }
                        }),
                    ],
                }),
            });
        }

        const initialDate = activeDate || currentDate || getState().currentDate;
        if (initialDate) {
            activeDate = initialDate;
            void ensureBodyLoaded(initialDate, { force: true });
        }
        shouldFocusEditor = true;
    });

    onDestroy(() => {
        void flushAutoSave();
        if (pendingStateSync && browser) {
            cancelAnimationFrame(pendingStateSync);
        }
        if (editorView) {
            editorView.destroy();
        }
    });

    async function handleBack(): Promise<void> {
        await flushAutoSave();
        if (!browser) return;
        await goto("/");
    }

    function handleInput(): void {
        hasDirtyEdits = true;
        scheduleStateSync();
        scheduleAutoSave();
    }

    function scheduleStateSync(): void {
        if (!browser) {
            pushBodyToState(textareaValue);
            return;
        }
        if (pendingStateSync) return;
        pendingStateSync = requestAnimationFrame(() => {
            pendingStateSync = 0;
            pushBodyToState(textareaValue);
        });
    }

    function scheduleAutoSave(): void {
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
        }
        if (typeof window === "undefined") return;

        autoSaveTimer = window.setTimeout(() => {
            autoSaveTimer = null;
            void save();
        }, AUTO_SAVE_DELAY);
    }
    async function focusTextarea(): Promise<void> {
        if (!browser || !editorView) return;
        await tick();
        editorView.focus();
        if (editorView.state.doc.length > 0) {
            editorView.dispatch({
                selection: { anchor: editorView.state.doc.length },
            });
        }
    }

    function handleSelectionUpdate(view: EditorView) {
        const { from, to } = view.state.selection.main;
        if (from === to) {
            aiSelection = null;
            aiSelectionRect = null;
            return;
        }

        const text = view.state.doc.sliceString(from, to).trim();
        if (!text) {
            aiSelection = null;
            aiSelectionRect = null;
            return;
        }

        aiSelection = { text, from, to };
        
        // Calculate position
        const startCoords = view.coordsAtPos(from);
        const endCoords = view.coordsAtPos(to);

        if (startCoords && endCoords) {
            aiSelectionRect = {
                top: Math.min(startCoords.top, endCoords.top),
                left: startCoords.left,
                bottom: Math.max(startCoords.bottom, endCoords.bottom),
                right: endCoords.right
            };
        }
    }

    async function handleAiAction(event: CustomEvent<{ instruction: string }>) {
        if (!aiSelection || !editorView) return;
        const { instruction } = event.detail;
        const { text, from, to } = aiSelection;

        aiSelection = null; // Hide menu immediately

        try {
            const payload = await getActiveAiInvokePayload();
            if (!payload || payload.providerId === "noai") return;

            const result = await invokeAiRewrite(payload, text, instruction);
            if (result) {
                editorView.dispatch({
                    changes: { from, to, insert: result },
                    selection: { anchor: from + result.length }
                });
            }
        } catch (e) {
            console.error("AI Rewrite failed", e);
        }
    }

    // 确保切换路由或组件卸载前队列中的自动保存已执行
    async function flushAutoSave(options: {
        targetDate?: string | null;
        triggerAi?: boolean;
    } = {}): Promise<void> {
        const { targetDate = activeDate, triggerAi = true } = options;
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = null;
            await save({
                dateOverride: targetDate,
                contentOverride: textareaValue,
                triggerAi,
            });
            return;
        }
        if (hasDirtyEdits) {
            await save({ dateOverride: targetDate, triggerAi });
        }
    }

    // 将草稿写入状态后再调用后端保存，保证乐观 UI 不阻塞
    async function save(options: SaveOptions = {}): Promise<void> {
        const { dateOverride, contentOverride, triggerAi = false } = options;
        const targetDate = dateOverride ?? activeDate ?? currentDate;
        if (!targetDate) return;

        const body = contentOverride ?? textareaValue;
        pushBodyToState(body);

        const existing = getSummary(targetDate);
        const optimistic: DiaryEntry = existing
            ? { ...existing, date: targetDate }
            : { date: targetDate };
        if (triggerAi) {
            optimistic.aiSummary = $t("timelineAiPending");
        }

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
            hasDirtyEdits = false;
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
        if (!browser || !date) return;
        if (!force && loadedDate === date) {
            initialLoadSettled = true;
            return;
        }
        if (loadingDate === date) return;

        loadingDate = date;
        try {
            const body = await getEntryBody(date);
            loadedDate = date;
            if (activeDate === date && !hasDirtyEdits) {
                applyTextareaValue(body ?? "", { markPristine: true });
            }
        } catch (error) {
            console.error("加载正文失败:", error);
        } finally {
            if (activeDate === date) {
                initialLoadSettled = true;
            }
            loadingDate = null;
        }
    }

    async function handleDateChange(nextDate: string): Promise<void> {
        const previousDate = activeDate;
        await flushAutoSave({ targetDate: previousDate, triggerAi: false });
        resetEditorForDate(nextDate);
        await ensureBodyLoaded(nextDate, { force: true });
    }

    function resetEditorForDate(date: string): void {
        activeDate = date;
        textareaValue = "";
        loadedDate = null;
        loadingDate = null;
        hasDirtyEdits = false;
        initialLoadSettled = false;
        setCurrentBody(null);
        shouldFocusEditor = true;
    }

    function applyTextareaValue(
        value: string,
        options: { markPristine?: boolean } = {},
    ): void {
        textareaValue = value;
        pushBodyToState(value);

        if (editorView && editorView.state.doc.toString() !== value) {
            ignoreNextUpdate = true;
            editorView.dispatch({
                changes: { from: 0, to: editorView.state.doc.length, insert: value },
            });
            ignoreNextUpdate = false;
        }

        if (options.markPristine) {
            hasDirtyEdits = false;
        }
    }

    function pushBodyToState(value: string): void {
        if (getState().currentBody !== value) {
            setCurrentBody(value);
        }
    }

    function buildDateMeta(
        dateValue?: string | null,
        localeValue?: Locale,
    ): {
        display: string;
        weekday: string;
    } {
        if (!dateValue) {
            return { display: $t("editorNoDate"), weekday: "" };
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
            aria-label={$t("editorBackHome")}
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
            <span>{$t("editorComplete")}</span>
        </button>

        <p class="editor-shell__date">
            {dateMeta.display}
            {#if dateMeta.weekday}
                <span class="editor-shell__weekday">· {dateMeta.weekday}</span>
            {/if}
        </p>
    </div>
    <div
        class="editor-shell__textarea"
        bind:this={editorContainer}
    ></div>

    <AiFloatingMenu 
        selection={aiSelection}
        rect={aiSelectionRect}
        on:action={handleAiAction}
        on:close={() => { aiSelection = null; aiSelectionRect = null; }}
    />
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

    :global(.cm-ghost-text) {
        pointer-events: none;
        user-select: none;
    }

    :global(.cm-grammar-error) {
        text-decoration: underline wavy var(--color-error, #f43f5e);
        text-decoration-skip-ink: none;
    }

    :global(.cm-grammar-tooltip) {
        background: var(--color-surface, #ffffff);
        border: 1px solid var(--color-border, #e5e7eb);
        padding: 8px 12px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        max-width: 280px;
    }

    :global(.cm-grammar-tooltip strong) {
        display: block;
        margin-bottom: 4px;
        font-size: 1rem;
    }

    :global(.cm-editor) {
        height: 100%;
    }

    :global(.cm-scroller) {
        font-family: inherit !important;
    }

    :global(.cm-content) {
        padding: 0 !important;
    }
</style>
