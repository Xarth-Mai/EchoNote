<script lang="ts">
    import { appStateStore, setTheme } from "$utils/state";

    const state = appStateStore;
    const themes: Array<{ label: string; value: "auto" | "light" | "dark" }> = [
        { label: "跟随系统", value: "auto" },
        { label: "浅色", value: "light" },
        { label: "深色", value: "dark" },
    ];
</script>

<svelte:head>
    <title>EchoNote · 设置</title>
</svelte:head>

<div class="settings">
    <section class="settings__panel surface-card">
        <header>
            <a class="settings__back" href="/">← 返回主页</a>
            <h1>设置中心</h1>
            <p>配置主题、日历偏好，保持设备一致的体验。</p>
        </header>

        <div class="settings__grid">
            <article
                class="surface-card surface-card--plain surface-card--tight"
            >
                <h2>主题模式</h2>
                <p>选择与系统或个人偏好一致的外观。</p>
                <div class="settings__choices">
                    {#each themes as theme}
                        <button
                            type="button"
                            class="btn"
                            class:btn--primary={$state.theme ===
                                theme.value}
                            class:btn--ghost={$state.theme !==
                                theme.value}
                            on:click={() => setTheme(theme.value)}
                        >
                            {theme.label}
                        </button>
                    {/each}
                </div>
            </article>
        </div>
    </section>
</div>

<style>
    .settings {
        max-width: 720px;
        margin: 0 auto;
    }

    .settings__panel header {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        margin-bottom: 1.5rem;
    }

    .settings__back {
        color: var(--color-accent);
        font-weight: 600;
        margin-bottom: 0.3rem;
    }

    .settings__grid {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .settings__choices {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
</style>
