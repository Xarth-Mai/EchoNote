<script lang="ts">
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import Calendar from "$lib/components/Calendar.svelte";
    import Timeline from "$lib/components/Timeline.svelte";
    import { appStateStore, setCurrentDate } from "$utils/state";

    const state = appStateStore;

    $: greeting = buildGreeting();
    $: subline = `今天是 ${new Date().toLocaleDateString("zh-CN", {
        month: "long",
        day: "numeric",
        weekday: "long",
    })}`;

    function buildGreeting(): string {
        const hour = new Date().getHours();
        if (hour < 6) return "凌晨好";
        if (hour < 12) return "早安";
        if (hour < 18) return "下午好";
        return "晚上好";
    }

    function startToday(): void {
        const today = new Date().toISOString().split("T")[0];
        setCurrentDate(today);
        if (browser) {
            void goto(`/editor?date=${today}`);
        }
    }

    function openSelectedDate(): void {
        const fallback = new Date().toISOString().split("T")[0];
        const target = $state.currentDate || fallback;
        setCurrentDate(target);
        if (browser) {
            void goto(`/editor?date=${target}`);
        }
    }
</script>

<svelte:head>
    <title>EchoNote</title>
</svelte:head>

<div class="home page-shell">
    <section class="surface-card home__intro">
        <div>
            <p class="eyebrow">{greeting}</p>
            <h1>记下你的灵感与情绪节奏</h1>
            <p class="muted-text">
                {subline}
            </p>
        </div>
        <div class="home__actions">
            <button
                type="button"
                class="btn btn--primary"
                on:click={startToday}
            >
                今日记录
            </button>
            <a class="btn btn--ghost" href="/settings"> 设置中心 </a>
        </div>
    </section>

    <div class="home__grid">
        <aside class="home__sidebar surface-card surface-card--flat">
            <Calendar />
        </aside>

        <section class="home__timeline surface-card surface-card--flat">
            <div class="timeline-header">
                <span>最新记录</span>
                <button
                    type="button"
                    class="btn btn--primary btn--compact"
                    on:click={openSelectedDate}
                >
                    去编辑
                </button>
            </div>
            <Timeline />
        </section>
    </div>
</div>

<style>
    .home {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .home__intro {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
    }

    .home__actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .home__grid {
        display: grid;
        gap: 1.5rem;
        flex: 1;
        min-height: 0;
    }

    @media (min-width: 992px) {
        .home__grid {
            grid-template-columns: 360px 1fr;
            align-items: start;
        }
    }

    .home__timeline {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        flex: 1;
        min-height: 0;
    }

    .timeline-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        font-weight: 600;
    }
</style>
