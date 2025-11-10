<script lang="ts">
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import { onDestroy } from "svelte";
    import { getEntryBody, saveEntryByDate } from "$utils/backend";
    import {
        appStateStore,
        getSummary,
        getState,
        setCurrentBody,
        upsertSummary,
    } from "$utils/state";
    import type { DiaryEntry } from "../../types";

    const state = appStateStore;

    let textareaValue = "";
    let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRenderedDate = "";
    let loadingDate: string | null = null;
    let lastLoadedDate: string | null = null;

    $: currentDate = $state.currentDate;
    $: currentBody = $state.currentBody;
    $: dateMeta = buildDateMeta(currentDate);

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
        if (!browser) return;
        void goto("/");
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
</script>

<div class="editor-shell">
    <div class="editor-shell__toolbar">
        <button
            type="button"
            class="editor-shell__ghost-btn"
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
            <span>时间线</span>
        </button>

        <p class="editor-shell__date">
            {dateMeta.display}
            {#if dateMeta.weekday}
                <span class="editor-shell__weekday">· {dateMeta.weekday}</span>
            {/if}
        </p>

        <div class="editor-shell__badge">
            <span class="editor-shell__dot" aria-hidden="true"></span>
            <span>自动保存开启</span>
        </div>
    </div>

    <div class="editor-shell__body">
        <textarea
            class="editor-shell__textarea"
            placeholder="记录你的灵感、片刻与感悟..."
            bind:value={textareaValue}
            on:input={handleInput}
        ></textarea>
    </div>
</div>
