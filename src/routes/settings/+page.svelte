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
    <section class="settings__panel">
        <header>
            <a class="settings__back" href="/">← 返回主页</a>
            <h1>设置中心</h1>
            <p>配置主题、日历偏好，保持设备一致的体验。</p>
        </header>

        <div class="settings__grid">
            <article>
                <h2>主题模式</h2>
                <p>选择与系统或个人偏好一致的外观。</p>
                <div class="settings__choices">
                    {#each themes as theme}
                        <button
                            type="button"
                            class:active={$state.theme === theme.value}
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
