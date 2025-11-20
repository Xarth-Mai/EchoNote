<script lang="ts">
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import {
        initLayoutListener,
        initThemeListener,
        upsertSummary,
    } from "$utils/state";
    import { initLocale, locale } from "$utils/i18n";
    import type { DiaryEntry } from "../types";
    import "../styles.css";

    $: currentLocale = $locale;
    $: ogLocale = currentLocale.replace("-", "_");

    onMount(() => {
        initThemeListener();
        initLocale();
        initLayoutListener();
        let cleanup: (() => void) | null = null;
        if (browser) {
            void import("@tauri-apps/api/event").then(({ listen }) => {
                listen<DiaryEntry>("entry-metadata-updated", (event) => {
                    if (event.payload) {
                        upsertSummary(event.payload);
                    }
                }).then((unlisten) => {
                    cleanup = unlisten;
                });
            });
        }

        return () => {
            cleanup?.();
        };
    });
</script>

<svelte:head>
    <meta name="language" content={currentLocale} />
    <meta property="og:locale" content={ogLocale} />
</svelte:head>

<div class="layout-shell">
    <main class="layout-shell__main">
        <slot />
    </main>
</div>
