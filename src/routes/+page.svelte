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

    $: layoutMode = $state.layoutMode;

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
    <title>EchoNote · 日历与时间线</title>
</svelte:head>

<div
    class="home"
    class:home--portrait={layoutMode === "portrait"}
    class:home--landscape={layoutMode === "landscape"}
>
    <section class="home__hero surface-card">
        <div>
            <p class="home__eyebrow">{greeting}</p>
            <h1>记下你的灵感与情绪节奏</h1>
            <p class="home__subtitle">{subline}</p>
        </div>
        <div class="home__hero-actions">
            <button
                type="button"
                class="pill-button pill-button--primary"
                on:click={startToday}
            >
                今日记录
            </button>
            <a class="pill-button pill-button--ghost" href="/settings">
                设置中心
            </a>
        </div>
    </section>

    <div class="home__layout">
        <aside class="home__sidebar surface-card surface-card--flat">
            <Calendar />
        </aside>

        <section class="home__timeline surface-card surface-card--flat">
            <div class="home__timeline-actions">
                <button
                    type="button"
                    class="pill-button pill-button--primary"
                    on:click={openSelectedDate}
                >
                    去编辑
                </button>
            </div>
            <Timeline />
        </section>
    </div>
</div>
