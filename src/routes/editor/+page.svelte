<script lang="ts">
    import { page } from "$app/stores";
    import Editor from "$lib/components/Editor.svelte";
    import { setCurrentDate } from "$utils/state";

    let lastSynced: string | null = null;

    $: urlDate = $page.url.searchParams.get("date");
    $: if (urlDate && urlDate !== lastSynced) {
        lastSynced = urlDate;
        setCurrentDate(urlDate);
    }
</script>

<svelte:head>
    <title>EchoNote · 编辑器</title>
</svelte:head>

<div class="editor-page">
    <Editor />
</div>


