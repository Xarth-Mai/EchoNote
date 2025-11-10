<script lang="ts">
    import { onMount } from "svelte";
    import Calendar from "$lib/components/Calendar.svelte";
    import Editor from "$lib/components/Editor.svelte";
    import Timeline from "$lib/components/Timeline.svelte";
    import {
        appStateStore,
        initLayoutListener,
        initThemeListener,
        setCalendarExpanded,
    } from "$utils/state";
    import { cx, UI } from "$utils/ui";

    const state = appStateStore;

    onMount(() => {
        initThemeListener();
        initLayoutListener();
    });

    $: layoutMode = $state.layoutMode;
    $: viewMode = $state.viewMode;
    $: editorFullscreen = $state.editorFullscreen;
    $: calendarExpanded = $state.calendarExpanded;

    $: appClasses = cx("h-full", layoutMode === "landscape" && "flex");
    $: homePanelClasses = cx(
        "h-full",
        "flex",
        "flex-col",
        layoutMode === "portrait" && viewMode === "editor" && "hidden",
        layoutMode === "landscape" && editorFullscreen && "hidden",
        layoutMode === "landscape" &&
            !editorFullscreen &&
            "w-21/55 border-r border-(--color-border-primary)",
    );
    $: editorPanelClasses = cx(
        "h-full",
        layoutMode === "portrait" && viewMode === "home" && "hidden",
        layoutMode === "landscape" && "flex-1",
    );

    $: toggleLabel = calendarExpanded ? "收起日历" : "展开日历";
    $: toggleIcon = calendarExpanded ? "▲" : "▼";
</script>

<svelte:head>
    <title>EchoNote</title>
</svelte:head>

<div class={appClasses}>
    <div class={homePanelClasses}>
        <div class="shrink-0 p-5 backdrop-blur-sm bg-(--color-bg-secondary)">
            <Calendar />
        </div>

        <div
            class="shrink-0 flex justify-center py-3 border-y backdrop-blur-sm border-(--color-border-primary) bg-(--color-bg-secondary)"
        >
            <button
                class={cx(UI.BTN_GHOST, "flex items-center gap-2 px-4")}
                on:click={() => setCalendarExpanded(!calendarExpanded)}
                aria-pressed={calendarExpanded}
            >
                <span class="text-xs">{toggleIcon}</span>
                <span>{toggleLabel}</span>
            </button>
        </div>

        <div class="flex-1 overflow-hidden">
            <Timeline />
        </div>
    </div>

    <div class={editorPanelClasses}>
        <Editor />
    </div>
</div>
