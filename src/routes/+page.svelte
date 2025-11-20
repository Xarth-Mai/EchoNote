<script lang="ts">
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import Calendar from "$lib/components/Calendar.svelte";
    import Timeline from "$lib/components/Timeline.svelte";
    import { appStateStore, setCurrentDate } from "$utils/state";
    import {
        formatFullDate,
        formatMonthDay,
        locale,
        t,
        type Locale,
    } from "$utils/i18n";

    const state = appStateStore;
    const localeStore = locale;
    const todayIso = new Date().toISOString().split("T")[0];
    let localeValue: Locale = "zh-CN";

    $: greeting = buildGreeting();
    $: localeValue = $localeStore;
    $: subline = t("homeSubline", {
        greeting,
        date: formatFullDate(new Date(), localeValue),
    });
    $: selectedDate = $state.currentDate || todayIso;
    $: primaryCtaLabel = buildPrimaryCtaLabel(selectedDate);

    function buildGreeting(): string {
        const hour = new Date().getHours();
        if (hour < 6) return t("greetingDawn");
        if (hour < 12) return t("greetingMorning");
        if (hour < 18) return t("greetingAfternoon");
        return t("greetingEvening");
    }

    function buildPrimaryCtaLabel(target: string): string {
        if (target === todayIso) {
            return t("homeTodayCta");
        }
        const label = formatMonthDayLabel(target);
        return label
            ? t("homeEditCtaWithDate", { date: label })
            : t("homeEditCta");
    }

    function formatMonthDayLabel(value: string): string {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "";
        }
        return formatMonthDay(date, localeValue);
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
    <section class="surface-card home__intro">
        <div>
            <p class="muted-text">
                {subline}
            </p>
            <h1>{t("homeTitle")}</h1>
        </div>
        <div class="home__actions">
            <button
                type="button"
                class="btn btn--primary"
                on:click={openSelectedDate}
            >
                {primaryCtaLabel}
            </button>
            <a class="btn btn--ghost" href="/settings">{t("homeSettings")}</a>
        </div>
    </section>

    <div class="home__grid">
        <aside class="home__sidebar surface-card surface-card--flat">
            <Calendar />
        </aside>

        <section class="home__timeline surface-card surface-card--flat">
            <Timeline />
        </section>
    </div>
</div>

<style>
    .home {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .home__intro {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
    }

    .home__actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .home__grid {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        flex: 1;
        min-height: 0;
    }

    @media (min-width: 992px) {
        .home__grid {
            display: grid;
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
        height: 100%;
    }
</style>
