<script lang="ts">
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import Calendar from "$lib/components/Calendar.svelte";
    import Card from "$lib/components/Card.svelte";
    import Toolbar from "$lib/components/Toolbar.svelte";
    import Timeline from "$lib/components/Timeline.svelte";
    import { appStateStore, setCurrentDate } from "$utils/state";

    const state = appStateStore;
    const todayIso = new Date().toISOString().split("T")[0];

    $: greeting = buildGreeting();
    $: subline = `${greeting}! 今天是 ${new Date().toLocaleDateString("zh-CN", {
        month: "long",
        day: "numeric",
        weekday: "long",
    })}`;
    $: selectedDate = $state.currentDate || todayIso;
    $: primaryCtaLabel = buildPrimaryCtaLabel(selectedDate);

    function buildGreeting(): string {
        const hour = new Date().getHours();
        if (hour < 6) return "凌晨好";
        if (hour < 12) return "早安";
        if (hour < 18) return "下午好";
        return "晚上好";
    }

    function buildPrimaryCtaLabel(target: string): string {
        if (target === todayIso) {
            return "今日记录";
        }
        const label = formatMonthDayLabel(target);
        return label ? `${label}-去编辑` : "去编辑";
    }

    function formatMonthDayLabel(value: string): string {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "";
        }
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${month}月${day}日`;
    }

    function openSelectedDate(): void {
        const target = selectedDate;
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
    <Card as="section" class="home__intro">
        <Toolbar
            class="home__intro-toolbar"
            gap="clamp(0.75rem, 2vw, 1.25rem)"
        >
            <div class="home__intro-copy">
                <p class="muted-text">
                    {subline}
                </p>
                <h1>记下你的灵感与情绪节奏</h1>
            </div>
            <div class="home__actions">
                <button
                    type="button"
                    class="btn btn--primary"
                    on:click={openSelectedDate}
                >
                    {primaryCtaLabel}
                </button>
                <a class="btn btn--ghost" href="/settings"> 设置中心 </a>
            </div>
        </Toolbar>
    </Card>

    <div class="home__grid">
        <Card as="aside" flat class="home__sidebar">
            <Calendar />
        </Card>

        <Card as="section" flat class="home__timeline">
            <Timeline />
        </Card>
    </div>
</div>

<style lang="scss">
    @use "../styles/mixins.scss" as mixins;

    .home {
        @include mixins.flex-column(1rem);
        flex: 1;
        min-height: 0;
    }

    :global(.home__intro-toolbar) {
        width: 100%;
    }

    .home__intro-copy {
        @include mixins.flex-column(0.5rem);
        min-width: 220px;
    }

    .home__actions {
        display: flex;
        flex-wrap: wrap;
        gap: clamp(0.6rem, 2vw, 0.9rem);
    }

    .home__grid {
        @include mixins.flex-column(1rem);
        flex: 1;
        min-height: 0;
    }

    @media (min-width: 992px) {
        .home__grid {
            display: grid;
            grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.1fr);
            align-items: start;
            gap: 1.25rem;
        }
    }

    :global(.home__timeline) {
        @include mixins.flex-column(1rem);
        flex: 1;
        min-height: 0;
        height: 100%;
    }
</style>
