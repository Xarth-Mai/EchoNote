<script lang="ts">
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import Calendar from "$lib/components/Calendar.svelte";
    import TypewriterText from "$lib/components/TypewriterText.svelte";
    import Timeline from "$lib/components/Timeline.svelte";
    import { generateHeroGreeting } from "$utils/greeting";
    import { appStateStore, setCurrentDate } from "$utils/state";
    import {
        formatFullDate,
        formatMonthDay,
        locale,
        translator,
        type Locale,
    } from "$utils/i18n";

    const state = appStateStore;
    const localeStore = locale;
    const t = translator;
    const today = new Date();
    const todayIso = (() => {
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    })();
    let localeValue: Locale = "zh-Hans";
    let aiGreeting: string | null = null;
    let greetingRequestId = 0;
    let debounceTimer: ReturnType<typeof setTimeout>;

    $: localeValue = $localeStore;
    $: fallbackGreeting = buildGreeting(today);
    $: greeting = aiGreeting?.trim() || fallbackGreeting;
    $: subline = $t("homeSubline", {
        date: formatFullDate(today, localeValue),
    });
    $: selectedDate = $state.currentDate || todayIso;
    $: primaryCtaLabel = buildPrimaryCtaLabel(selectedDate);
    $: if (browser) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            void updateHeroGreeting(localeValue);
        }, 500);
    }

    function buildGreeting(reference: Date): string {
        const hour = reference.getHours();
        if (hour < 6) return $t("greetingDawn");
        if (hour < 12) return $t("greetingMorning");
        if (hour < 18) return $t("greetingAfternoon");
        return $t("greetingEvening");
    }

    function buildPrimaryCtaLabel(target: string): string {
        if (target === todayIso) {
            return $t("homeTodayCta");
        }
        const label = formatMonthDayLabel(target);
        return label
            ? $t("homeEditCtaWithDate", { date: label })
            : $t("homeEditCta");
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

    async function updateHeroGreeting(localeSnapshot: Locale): Promise<void> {
        const requestId = ++greetingRequestId;
        try {
            const generated = await generateHeroGreeting({
                today,
                locale: localeSnapshot,
            });
            if (requestId === greetingRequestId) {
                aiGreeting = generated;
            }
        } catch (error) {
            console.error("生成 AI 问候语失败:", error);
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
            <h1>
                <TypewriterText text={greeting} />
            </h1>
        </div>
        <div class="home__actions">
            <button
                type="button"
                class="btn btn--primary"
                on:click={openSelectedDate}
            >
                {primaryCtaLabel}
            </button>
            <a class="btn btn--ghost" href="/settings">{$t("homeSettings")}</a>
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
