<script lang="ts">
    import Card from "$lib/components/Card.svelte";
    import Toolbar from "$lib/components/Toolbar.svelte";
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
    <Card as="section" shadow class="settings__panel">
        <Toolbar
            as="header"
            class="settings__toolbar"
            gap="clamp(0.75rem, 2vw, 1.25rem)"
        >
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
        </Toolbar>

        <div class="settings__grid scroll-fade">
            <Card as="article" padding="tight">
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
            </Card>
            <Card as="article" padding="tight">
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
            </Card>
            <Card as="article" padding="tight">
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
            </Card>
            <Card as="article" padding="tight">
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
            </Card>
            <Card as="article" padding="tight">
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
            </Card>
        </div>
    </Card>
</div>

<style lang="scss">
    @use "../../styles/mixins.scss" as mixins;

    .settings {
        @include mixins.flex-column(0);
        flex: 1;
        min-height: 0;
    }

    :global(.settings__panel) {
        @include mixins.flex-column(0);
        flex: 1;
        min-height: 0;
        overflow: hidden;
        height: 100%;
    }

    :global(.settings__toolbar) {
        width: 100%;
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
        @include mixins.flex-column(1rem);
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding-right: 0.25rem;
        padding-top: 1rem;
    }

    .settings__choices {
        display: flex;
        flex-wrap: wrap;
        gap: clamp(0.65rem, 2vw, 0.85rem);
    }

    @media (max-width: 720px) and (orientation: portrait) {
        :global(.settings__panel) {
            border-radius: var(--radius-md);
        }

        :global(.settings__toolbar) {
            margin-bottom: 0.35rem;
        }

        .settings__grid {
            gap: clamp(0.75rem, 4vw, 1rem);
            padding-right: 0;
            padding-top: 0.75rem;
        }

        .settings__choices {
            gap: clamp(0.5rem, 4vw, 0.75rem);
        }
    }
</style>
