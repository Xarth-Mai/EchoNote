<script lang="ts">
    import { onMount } from "svelte";
    import { initLayoutListener, initThemeListener } from "$utils/state";
    import "../styles.css";

    onMount(() => {
        initThemeListener();
        initLayoutListener();
    });
</script>

<div class="layout-shell">
    <main class="layout-shell__main">
        <slot />
    </main>
</div>
