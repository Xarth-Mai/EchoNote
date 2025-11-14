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

<div class="settings page-shell">
    <section class="settings__panel surface-card surface-card--shadow">
        <header class="settings__toolbar">
            <a
                href="/"
                class="btn btn--ghost btn--compact settings__back-btn"
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
                <span>返回</span>
            </a>
            <p class="settings__caption">设置中心</p>
        </header>

        <div class="settings__grid scroll-fade">
            <article class="surface-card surface-card--tight">
                <h2>主题模式</h2>
                <p>选择与系统或个人偏好一致的外观。</p>
                <div class="settings__choices">
                    {#each themes as theme}
                        <button
                            type="button"
                            class="btn"
                            class:btn--primary={$state.theme === theme.value}
                            class:btn--ghost={$state.theme !== theme.value}
                            on:click={() => setTheme(theme.value)}
                        >
                            {theme.label}
                        </button>
                    {/each}
                </div>
            </article>
            <article class="surface-card surface-card--tight">
                <h2>主题模式</h2>
                <p>选择与系统或个人偏好一致的外观。</p>
                <div class="settings__choices">
                    {#each themes as theme}
                        <button
                            type="button"
                            class="btn"
                            class:btn--primary={$state.theme === theme.value}
                            class:btn--ghost={$state.theme !== theme.value}
                            on:click={() => setTheme(theme.value)}
                        >
                            {theme.label}
                        </button>
                    {/each}
                </div>
            </article>
            <article class="surface-card surface-card--tight">
                <h2>主题模式</h2>
                <p>选择与系统或个人偏好一致的外观。</p>
                <div class="settings__choices">
                    {#each themes as theme}
                        <button
                            type="button"
                            class="btn"
                            class:btn--primary={$state.theme === theme.value}
                            class:btn--ghost={$state.theme !== theme.value}
                            on:click={() => setTheme(theme.value)}
                        >
                            {theme.label}
                        </button>
                    {/each}
                </div>
            </article>
            <article class="surface-card surface-card--tight">
                <h2>主题模式</h2>
                <p>选择与系统或个人偏好一致的外观。</p>
                <div class="settings__choices">
                    {#each themes as theme}
                        <button
                            type="button"
                            class="btn"
                            class:btn--primary={$state.theme === theme.value}
                            class:btn--ghost={$state.theme !== theme.value}
                            on:click={() => setTheme(theme.value)}
                        >
                            {theme.label}
                        </button>
                    {/each}
                </div>
            </article>
            <article class="surface-card surface-card--tight">
                <h2>主题模式</h2>
                <p>选择与系统或个人偏好一致的外观。</p>
                <div class="settings__choices">
                    {#each themes as theme}
                        <button
                            type="button"
                            class="btn"
                            class:btn--primary={$state.theme === theme.value}
                            class:btn--ghost={$state.theme !== theme.value}
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
        flex: 1;
        display: flex;
        min-height: 0;
    }

    .settings__panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
    }

    .settings__toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 0.5rem;
    }

    .settings__back-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
    }

    .settings__caption {
        margin: 0;
        font-weight: 600;
        color: var(--color-text-muted);
        padding-right: 0.75rem;
    }

    .settings__grid {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding-right: 0.25rem;
        padding-top: 1rem;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
    }

    .settings__grid::-webkit-scrollbar {
        display: none;
    }

    .settings__choices {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
</style>
