<script lang="ts">
    import { page } from "$app/stores";
    import { browser } from "$app/environment";
    import Editor from "$lib/components/Editor.svelte";
    import { setCurrentDate } from "$utils/state";
    import { onMount } from "svelte";

    let lastSynced: string | null = null;

    function syncDateFromUrl(url: URL) {
        const urlDate = url.searchParams.get("date");
        if (urlDate && urlDate !== lastSynced) {
            lastSynced = urlDate;
            setCurrentDate(urlDate);
        }
    }

    onMount(() => {
        if (!browser) return;
        const unsubscribe = page.subscribe(($page) => syncDateFromUrl($page.url));
        return () => unsubscribe();
    });
</script>

<svelte:head>
    <title>EchoNote · 编辑器</title>
</svelte:head>

<div class="editor-page page-shell">
    <Editor />
</div>

<style>
    .editor-page {
        flex: 1;
    }

    .editor-page :global(.editor-shell) {
        width: 100%;
        flex: 1;
    }

    .editor-page :global(.editor-shell__body) {
        flex: 1;
        display: flex;
    }

    .editor-page :global(.editor-shell__textarea) {
        flex: 1;
        min-height: 0;
    }
</style>
