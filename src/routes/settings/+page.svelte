<script lang="ts">
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { appStateStore, setTheme } from "$utils/state";
    import {
        listAiModels,
        storeProviderApiKey,
        deleteProviderApiKey,
        loadProviderModelCache,
        loadProviderBaseUrl,
        storeProviderBaseUrl,
        deleteProviderSlot,
        loadProviderModel,
        storeProviderModel,
    } from "$utils/backend";
    import {
        createCustomProviderConfig,
        loadAiSettingsState,
        saveAiSettingsState,
        sanitizeState,
        DEFAULT_AI_PROMPT,
        DEFAULT_TEMPERATURE,
        getDefaultMaxTokens,
    } from "$utils/ai";
    import type {
        AiProviderConfig,
        AiProviderId,
        AiSettingsState,
    } from "../../types";
    import {
        locale,
        localeOptions,
        setLocale,
        t,
        type Locale,
    } from "$utils/i18n";

    const state = appStateStore;
    const localeStore = locale;
    let themes: Array<{ label: string; value: "auto" | "light" | "dark" }> = [];
    let localeValue: Locale = "zh-CN";

    const BUILTIN_ORDER: Record<string, number> = {
        noai: -1,
        chatgpt: 0,
        deepseek: 1,
        gemini: 2,
        claude: 3,
    };
    const API_KEY_PLACEHOLDER = "sk-xxxxxxxxxxxxxxxx";

    const appVersion: string = __APP_VERSION__ ?? "0.0.0";
    let aiState: AiSettingsState = sanitizeState(loadAiSettingsState());
    let activeProviderId: AiProviderId = aiState.activeProviderId;
    let providerOptions: AiProviderConfig[] = [];
    let currentProvider: AiProviderConfig = getCurrentProvider();
    let providerModels: Partial<Record<AiProviderId, string[]>> = {};
    let formBaseUrl = "";
    let formApiKey = getStoredApiKeyPlaceholder(activeProviderId);
    let formModel = "";
    let formPrompt = aiState.advanced.prompt;
    let formTemperature = String(aiState.advanced.temperature);
    let formMaxTokens = String(aiState.advanced.maxTokens);
    let statusBanner: { text: string; tone: "ok" | "error" | "info" } | null =
        null;
    let savingBasic = false;
    let savingAdvanced = false;
    let loadingModels = false;
    let customSuffix = "";
    let customBaseUrl = "";
    let modelOptions: string[] = [];
    let advancedOpen = false;
    let apiKeyDirty = false;
    let basicDirty = false;
    let advancedDirty = false;
    let unsafeConfirmTarget: { baseUrl: string; warnings: string[] } | null =
        null;
    let selectedLocale: Locale = "zh-CN";

    $: aiState = sanitizeState(aiState);
    $: localeValue = $localeStore;
    $: selectedLocale = localeValue;
    $: themes = [
        { label: t("settingsThemeFollow"), value: "auto" },
        { label: t("settingsThemeLight"), value: "light" },
        { label: t("settingsThemeDark"), value: "dark" },
    ];
    $: {
        if (!aiState.providers[activeProviderId]) {
            activeProviderId = "noai";
            aiState.activeProviderId = "noai";
        }
    }
    $: providerOptions = Object.values(aiState.providers)
        .filter((provider): provider is AiProviderConfig => Boolean(provider))
        .sort((a, b) => {
            const orderA = BUILTIN_ORDER[a.id] ?? 10;
            const orderB = BUILTIN_ORDER[b.id] ?? 10;
            if (orderA !== orderB) return orderA - orderB;
            return a.label.localeCompare(b.label);
        });
    $: syncFormWithProvider();
    $: modelOptions =
        providerModels[activeProviderId] ?? (formModel ? [formModel] : []);
    $: normalizedCandidateBase = normalizedBaseUrl(formBaseUrl);
    $: unsafeConfirmActive =
        Boolean(
            unsafeConfirmTarget &&
                unsafeConfirmTarget.baseUrl === normalizedCandidateBase &&
                currentProvider.editable,
        ) && !savingBasic;
    $: basicSaveLabel = savingBasic
        ? t("saving")
        : unsafeConfirmActive
          ? t("confirmRiskAndSave")
          : t("saveBasic");
    $: showAiForm = activeProviderId !== "noai";
    $: if (!showAiForm) {
        advancedOpen = false;
    }
    $: hasUnsavedChanges = basicDirty || advancedDirty || apiKeyDirty;
    $: displayedStatusBanner =
        statusBanner ??
        (hasUnsavedChanges
            ? { tone: "info", text: t("statusUnsavedChanges") }
            : null);
    $: if (!advancedDirty) {
        formPrompt = aiState.advanced.prompt;
        formTemperature = String(aiState.advanced.temperature);
        formMaxTokens = String(aiState.advanced.maxTokens);
    }

    function getCurrentProvider(): AiProviderConfig {
        return (
            aiState.providers[activeProviderId] ??
            Object.values(aiState.providers).find(
                (item): item is AiProviderConfig => Boolean(item),
            ) ??
            createCustomProviderConfig("default", "https://api.openai.com/v1")
        );
    }

    function syncFormWithProvider(): void {
        currentProvider = getCurrentProvider();
        const provider = currentProvider;
        formBaseUrl = provider.baseUrl;
        formApiKey = getStoredApiKeyPlaceholder(provider.id);
        formModel = provider.model ?? "";
        apiKeyDirty = false;
        unsafeConfirmTarget = null;
        void hydrateProviderFromBackend();
    }

    function hasStoredApiKey(providerId: AiProviderId): boolean {
        return Boolean(aiState.apiKeyHints?.[providerId]);
    }

    function getStoredApiKeyPlaceholder(providerId: AiProviderId): string {
        return hasStoredApiKey(providerId) ? API_KEY_PLACEHOLDER : "";
    }

    function setStoredApiKeyFlag(
        providerId: AiProviderId,
        hasKey: boolean,
    ): void {
        if (!hasKey) {
            delete aiState.apiKeyHints[providerId];
            return;
        }
        aiState.apiKeyHints[providerId] = API_KEY_PLACEHOLDER;
    }

    async function hydrateProviderFromBackend(): Promise<void> {
        if (!browser) return;
        const provider = getCurrentProvider();
        const baseUrl = await loadProviderBaseUrl(provider.id);
        if (baseUrl) {
            formBaseUrl = baseUrl;
            provider.baseUrl = baseUrl;
        }
        const cached = await loadProviderModelCache(provider.id);
        if (cached && cached.length > 0) {
            providerModels = { ...providerModels, [provider.id]: cached };
            const storedModel = await loadProviderModel(provider.id);
            const pick =
                storedModel && cached.includes(storedModel)
                    ? storedModel
                    : cached[0];
            formModel = pick;
            provider.model = formModel;
        }
    }

    onMount(() => {
        syncFormWithProvider();
    });

    function normalizedBaseUrl(value: string): string {
        const trimmed = value.trim();
        return trimmed || "https://api.openai.com/v1";
    }

    function analyzeBaseUrlSafety(value: string): {
        normalized: string;
        warnings: string[];
        valid: boolean;
        error?: string;
    } {
        const normalized = normalizedBaseUrl(value);
        try {
            const parsed = new URL(normalized);
            const warnings: string[] = [];
            if (parsed.protocol !== "https:") {
                warnings.push(t("statusBaseNonHttps"));
            }
            const hostname = parsed.hostname.toLowerCase();
            if (hostname === "localhost" || hostname.endsWith(".local")) {
                warnings.push(t("statusBaseLocalhost"));
            } else if (isPrivateHost(hostname)) {
                warnings.push(t("statusBasePrivate"));
            }
            return { normalized, warnings, valid: true };
        } catch (_error) {
            return {
                normalized,
                warnings: [],
                valid: false,
                error: t("baseUrlFormatError"),
            };
        }
    }

    function isPrivateHost(hostname: string): boolean {
        return isPrivateIpv4(hostname) || isUnsafeIpv6(hostname);
    }

    function isPrivateIpv4(hostname: string): boolean {
        const parts = hostname.split(".");
        if (parts.length !== 4) return false;
        const octets = parts.map((part) => Number(part));
        if (
            octets.some(
                (octet) => Number.isNaN(octet) || octet < 0 || octet > 255,
            )
        ) {
            return false;
        }
        if (octets[0] === 10) return true;
        if (octets[0] === 127) return true;
        if (octets[0] === 169 && octets[1] === 254) return true;
        if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
            return true;
        if (octets[0] === 192 && octets[1] === 168) return true;
        return false;
    }

    function isUnsafeIpv6(hostname: string): boolean {
        if (!hostname.includes(":")) return false;
        const normalized = hostname.toLowerCase();
        return (
            normalized === "::1" ||
            normalized === "::" ||
            normalized.startsWith("fc") ||
            normalized.startsWith("fd") ||
            normalized.startsWith("fe80")
        );
    }

    function setActiveProvider(id: AiProviderId): void {
        if (!aiState.providers[id]) {
            return;
        }
        aiState.activeProviderId = id;
        activeProviderId = id;
        statusBanner = null;
        unsafeConfirmTarget = null;
        syncFormWithProvider();
        basicDirty = true;
    }

    function markBasicDirty(): void {
        basicDirty = true;
        statusBanner = null;
    }

    function markAdvancedDirty(): void {
        advancedDirty = true;
        statusBanner = null;
    }

    async function fetchModels(): Promise<void> {
        if (!browser) return;
        const provider = getCurrentProvider();
        if (provider.id === "noai") {
            statusBanner = { tone: "error", text: t("statusAiDisabled") };
            return;
        }
        loadingModels = true;
        statusBanner = null;
        const baseUrl = provider.editable
            ? normalizedBaseUrl(formBaseUrl)
            : provider.baseUrl;
        try {
            await persistCurrentApiKey(provider);
            provider.baseUrl = baseUrl;
            saveAiSettingsState(aiState);
            await storeProviderBaseUrl(provider.id, baseUrl);
            const models = await listAiModels({
                baseUrl,
                providerId: provider.id,
            });
            provider.baseUrl = baseUrl;
            providerModels = {
                ...providerModels,
                [provider.id]: models,
            };
            if (models.length === 0) {
                statusBanner = { tone: "error", text: t("statusNoModels") };
            } else {
                if (!models.includes(formModel)) {
                    formModel = models[0];
                    provider.model = formModel;
                }
                saveAiSettingsState(aiState);
                statusBanner = {
                    tone: "ok",
                    text: t("statusModelsFetched", { count: models.length }),
                };
            }
        } catch (error) {
            console.error("Failed to fetch models", error);
            statusBanner = { tone: "error", text: t("statusFetchModelsFailed") };
        } finally {
            loadingModels = false;
        }
    }

    function handleProviderSelect(event: Event): void {
        const target = event.currentTarget as HTMLSelectElement;
        setActiveProvider(target.value as AiProviderId);
    }

    function handleBaseInput(event: Event): void {
        const provider = getCurrentProvider();
        if (!provider.editable) {
            formBaseUrl = provider.baseUrl;
            return;
        }
        const value = (event.currentTarget as HTMLInputElement).value;
        formBaseUrl = value;
        provider.baseUrl = value;
        unsafeConfirmTarget = null;
        markBasicDirty();
    }

    function handleApiKeyInput(event: Event): void {
        const value = (event.currentTarget as HTMLInputElement).value;
        formApiKey = value;
        apiKeyDirty = true;
        markBasicDirty();
    }

    function handleModelChange(event: Event): void {
        const value = (event.currentTarget as HTMLSelectElement).value;
        formModel = value;
        const provider = getCurrentProvider();
        provider.model = value;
        markBasicDirty();
    }

    function handlePromptInput(event: Event): void {
        const value = (event.currentTarget as HTMLTextAreaElement).value;
        formPrompt = value;
        markAdvancedDirty();
    }

    function handleTemperatureInput(event: Event): void {
        const value = (event.currentTarget as HTMLInputElement).value;
        formTemperature = value;
        markAdvancedDirty();
    }

    function handleMaxTokensInput(event: Event): void {
        const value = (event.currentTarget as HTMLInputElement).value;
        formMaxTokens = value;
        markAdvancedDirty();
    }

    function getProviderLabel(provider: AiProviderConfig): string {
        if (provider.id === "noai") return t("providerNoAi");
        if (provider.id === "chatgpt") return t("providerChatgpt");
        if (provider.id === "deepseek") return t("providerDeepseek");
        if (provider.id === "gemini") return t("providerGemini");
        if (provider.id === "claude") return t("providerClaude");
        return provider.label;
    }

    function handleLocaleChange(event: Event): void {
        const nextLocale = (event.currentTarget as HTMLSelectElement)
            .value as Locale;
        selectedLocale = nextLocale;
        setLocale(nextLocale);
    }

    function addCustomProvider(): void {
        const suffix = customSuffix.trim();
        if (!suffix) {
            statusBanner = { tone: "error", text: t("statusSuffixRequired") };
            return;
        }
        const candidateId = `openai-custom-${suffix}` as AiProviderId;
        if (aiState.providers[candidateId]) {
            statusBanner = { tone: "error", text: t("statusSuffixDuplicate") };
            return;
        }
        const provider = createCustomProviderConfig(
            suffix,
            customBaseUrl || normalizedBaseUrl(formBaseUrl),
        );
        aiState.providers[provider.id] = provider;
        customSuffix = "";
        customBaseUrl = "";
        unsafeConfirmTarget = null;
        statusBanner = { tone: "ok", text: t("statusCustomAdded") };
        setActiveProvider(provider.id);
    }

    async function removeActiveCustom(): Promise<void> {
        if (!activeProviderId.startsWith("openai-custom-")) {
            statusBanner = {
                tone: "error",
                text: t("statusDeleteCustomOnly"),
            };
            return;
        }

        try {
            await deleteProviderApiKey(activeProviderId);
            await deleteProviderSlot(activeProviderId);
        } catch (error) {
            console.error("Failed to delete stored secret", error);
        }

        const nextProviders = { ...aiState.providers };
        delete nextProviders[activeProviderId];
        const nextHints = { ...aiState.apiKeyHints };
        delete nextHints[activeProviderId];

        aiState = sanitizeState({
            activeProviderId: "noai",
            providers: nextProviders as Record<AiProviderId, AiProviderConfig>,
            advanced: aiState.advanced,
            apiKeyHints: nextHints as Partial<Record<AiProviderId, string>>,
        });
        activeProviderId = aiState.activeProviderId;
        providerModels = {};
        syncFormWithProvider();
        saveAiSettingsState(aiState);
        statusBanner = { tone: "ok", text: t("statusCustomDeleted") };
    }

    function resetAdvancedSettings(): void {
        const defaults = getDefaultMaxTokens(activeProviderId);
        formPrompt = DEFAULT_AI_PROMPT;
        formTemperature = String(DEFAULT_TEMPERATURE);
        formMaxTokens = String(defaults);
        markAdvancedDirty();
        void handleAdvancedSave(true, t("statusResetAdvanced"));
    }

    async function persistCurrentApiKey(
        provider: AiProviderConfig,
    ): Promise<void> {
        if (!apiKeyDirty) return;
        if (!browser) return;
        const trimmed = formApiKey.trim();
        if (!trimmed) {
            await deleteProviderApiKey(provider.id);
            setStoredApiKeyFlag(provider.id, false);
            formApiKey = "";
            apiKeyDirty = false;
            return;
        }
        if (trimmed === API_KEY_PLACEHOLDER) {
            if (hasStoredApiKey(provider.id)) {
                apiKeyDirty = false;
                formApiKey = API_KEY_PLACEHOLDER;
                return;
            }
            statusBanner = { tone: "error", text: t("statusApiKeyInvalid") };
            formApiKey = "";
            apiKeyDirty = false;
            return;
        }
        await storeProviderApiKey(provider.id, trimmed);
        setStoredApiKeyFlag(provider.id, true);
        formApiKey = API_KEY_PLACEHOLDER;
        apiKeyDirty = false;
    }

    function handleFormSubmit(event: Event): void {
        event.preventDefault();
        void handleBasicSave(true);
    }

    async function handleBasicSave(showBanner = true): Promise<void> {
        if (savingBasic) return;
        const provider = getCurrentProvider();
        if (provider.id === "noai") {
            try {
                savingBasic = true;
                aiState.activeProviderId = provider.id;
                saveAiSettingsState(aiState);
                basicDirty = false;
                if (showBanner) {
                    statusBanner = { tone: "ok", text: t("statusAiOff") };
                }
            } catch (error) {
                console.error("Failed to disable AI", error);
                if (showBanner) {
                    statusBanner = { tone: "error", text: t("statusAiOffFailed") };
                }
            } finally {
                savingBasic = false;
            }
            return;
        }
        if (!formModel.trim()) {
            statusBanner = { tone: "error", text: t("statusModelRequired") };
            return;
        }
        let analyzedBase: ReturnType<typeof analyzeBaseUrlSafety> | null = null;
        if (provider.editable) {
            analyzedBase = analyzeBaseUrlSafety(formBaseUrl);
            if (!analyzedBase.valid) {
                unsafeConfirmTarget = null;
                statusBanner = {
                    tone: "error",
                    text: analyzedBase.error ?? t("statusBaseInvalid"),
                };
                return;
            }
            const confirmMatched =
                unsafeConfirmTarget &&
                unsafeConfirmTarget.baseUrl === analyzedBase.normalized;
            if (analyzedBase.warnings.length > 0 && !confirmMatched) {
                unsafeConfirmTarget = {
                    baseUrl: analyzedBase.normalized,
                    warnings: analyzedBase.warnings,
                };
                const warningText = analyzedBase.warnings.join("、");
                statusBanner = {
                    tone: "error",
                    text: t("statusBaseRisk", { warnings: warningText }),
                };
                return;
            }
            provider.baseUrl = analyzedBase.normalized;
            unsafeConfirmTarget = null;
        } else {
            unsafeConfirmTarget = null;
        }
        provider.model = formModel;

        try {
            savingBasic = true;
            statusBanner = null;
            await storeProviderBaseUrl(provider.id, provider.baseUrl);
            if (provider.model) {
                await storeProviderModel(provider.id, provider.model);
            }
            await persistCurrentApiKey(provider);
            saveAiSettingsState(aiState);
            basicDirty = false;
            if (showBanner) {
                statusBanner = { tone: "ok", text: t("statusBasicSaved") };
            }
        } catch (error) {
            console.error("Failed to save basic settings", error);
            if (showBanner) {
                statusBanner = { tone: "error", text: t("statusBasicSaveFailed") };
            }
        } finally {
            savingBasic = false;
        }
    }

    async function handleAdvancedSave(
        showBanner = true,
        message = t("statusAdvancedSaved"),
    ): Promise<void> {
        if (savingAdvanced) return;
        const provider = getCurrentProvider();
        if (provider.id === "noai") {
            statusBanner = { tone: "error", text: t("statusAdvancedSaveBlocked") };
            return;
        }

        try {
            savingAdvanced = true;
            aiState.advanced.prompt = formPrompt || DEFAULT_AI_PROMPT;
            aiState.advanced.temperature =
                Number(formTemperature) || DEFAULT_TEMPERATURE;
            aiState.advanced.maxTokens =
                Number(formMaxTokens) || getDefaultMaxTokens(activeProviderId);
            saveAiSettingsState(aiState);
            advancedDirty = false;
            if (showBanner) {
                statusBanner = { tone: "ok", text: message };
            }
        } catch (error) {
            console.error("Failed to save advanced settings", error);
            if (showBanner) {
                statusBanner = { tone: "error", text: t("statusAdvancedSaveFailed") };
            }
        } finally {
            savingAdvanced = false;
        }
    }
</script>

<svelte:head>
    <title>{`${t("appName")} · ${t("settingsHeadTitle")}${localeValue ? "" : ""}`}</title>
</svelte:head>

<div class="settings page-shell">
    <section class="settings__panel surface-card surface-card--shadow">
        <header class="settings__toolbar">
            <a
                href="/"
                class="btn btn--ghost btn--compact settings__back-btn"
                aria-label={t("editorBackHome")}
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
                <span>{t("settingsBack")}</span>
            </a>
            <p class="settings__caption">{t("settingsCaption")}</p>
        </header>

        <div class="settings__grid scroll-fade">
            <article class="surface-card surface-card--tight">
                <h2>{t("settingsAppInfoTitle")}</h2>
                <p>{t("settingsAppInfoDescription")}</p>
                <div class="settings__field settings__field--inline">
                    <span>{t("settingsVersionLabel")}</span>
                    <span class="settings__value">{appVersion}</span>
                </div>
            </article>

            <article class="surface-card surface-card--tight">
                <h2>{t("settingsLanguageTitle")}</h2>
                <p>{t("settingsLanguageDescription")}</p>
                <div class="settings__field">
                    <select
                        class="settings__select"
                        bind:value={selectedLocale}
                        on:change={handleLocaleChange}
                    >
                        {#each localeOptions as option}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                </div>
            </article>

            <article class="surface-card surface-card--tight">
                <h2>{t("settingsThemeTitle")}</h2>
                <p>{t("settingsThemeDescription")}</p>
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
                <h2>{t("settingsAiTitle")}</h2>
                <p>{t("settingsAiDescription")}</p>
                <form class="settings__form" on:submit={handleFormSubmit}>
                    <label class="settings__field">
                        <span>{t("settingsApiType")}</span>
                        <select
                            bind:value={activeProviderId}
                            on:change={handleProviderSelect}
                        >
                            {#each providerOptions as provider}
                                <option value={provider.id}>
                                    {getProviderLabel(provider)}
                                </option>
                            {/each}
                        </select>
                    </label>

                    {#if showAiForm}
                        <label class="settings__field">
                            <span>Base URL</span>
                            <input
                                type="text"
                                placeholder="https://api.openai.com/v1"
                            bind:value={formBaseUrl}
                            on:input={handleBaseInput}
                            disabled={!currentProvider.editable}
                        />
                        {#if !currentProvider.editable}
                            <small class="settings__hint">
                                {t("settingsFixedBaseUrl")}
                            </small>
                        {:else}
                            <small class="settings__hint">
                                {t("settingsBaseUrlExample")}
                            </small>
                        {/if}
                    </label>

                    <label class="settings__field">
                        <span>API Key</span>
                        <input
                            type="password"
                                autocomplete="off"
                                placeholder="sk-..."
                                bind:value={formApiKey}
                                on:input={handleApiKeyInput}
                        />
                        <small class="settings__hint">
                            {t("settingsApiKeyHint")}
                        </small>
                    </label>

                    <label class="settings__field">
                        <span>{t("settingsDefaultModel")}</span>
                        <div class="settings__model-row">
                            <select
                                bind:value={formModel}
                                    on:change={handleModelChange}
                                    disabled={modelOptions.length === 0}
                            >
                                {#if modelOptions.length === 0}
                                        <option value=""
                                            >{t("settingsFetchModelsPlaceholder")}</option
                                        >
                                {/if}
                                {#each modelOptions as model}
                                    <option value={model}>{model}</option>
                                    {/each}
                                </select>
                                <button
                                    type="button"
                                    class="btn btn--ghost"
                                    on:click={fetchModels}
                                    disabled={loadingModels}
                                >
                                    {loadingModels
                                        ? t("settingsRefreshingModels")
                                        : t("settingsRefreshModels")}
                                </button>
                            </div>
                            <small class="settings__hint">
                                {t("settingsModelTip")}
                            </small>
                        </label>

                        <div class="settings__advanced-toggle">
                            <span>{t("settingsAdvancedTitle")}</span>
                            <button
                                type="button"
                                class="btn btn--ghost"
                                on:click={() => (advancedOpen = !advancedOpen)}
                            >
                                {advancedOpen
                                    ? t("settingsToggleAdvancedHide")
                                    : t("settingsToggleAdvancedShow")}
                            </button>
                        </div>

                        {#if advancedOpen}
                            <label class="settings__field">
                                <span>{t("settingsCustomPrompt")}</span>
                                <textarea
                                    rows="4"
                                    bind:value={formPrompt}
                                    on:input={handlePromptInput}
                                ></textarea>
                                <small class="settings__hint">
                                    {t("settingsPromptTip")}
                                </small>
                            </label>

                            <label class="settings__field">
                                <span>{t("settingsTemperature")}</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="2"
                                    step="0.05"
                                    placeholder={t("settingsTemperaturePlaceholder")}
                                    bind:value={formTemperature}
                                    on:input={handleTemperatureInput}
                                />
                                <small class="settings__hint">
                                    {t("settingsTemperatureTip")}
                                </small>
                            </label>

                            <label class="settings__field">
                                <span>{t("settingsMaxTokens")}</span>
                                <input
                                    type="number"
                                    min="1"
                                    placeholder={t("settingsMaxTokensPlaceholder")}
                                    bind:value={formMaxTokens}
                                    on:input={handleMaxTokensInput}
                                />
                                <small class="settings__hint">
                                    {t("settingsMaxTokensTip")}
                                </small>
                            </label>
                        {/if}
                    {:else}
                        <p class="settings__placeholder">
                            {t("settingsAiDisabledNote")}
                        </p>
                    {/if}

                    <div class="settings__actions settings__actions--inline">
                        {#if showAiForm && advancedOpen}
                            <button
                                type="button"
                                class="btn btn--primary"
                                on:click={() => handleAdvancedSave()}
                                disabled={savingAdvanced}
                            >
                                {savingAdvanced
                                    ? t("saving")
                                    : t("settingsSaveAdvanced")}
                            </button>
                            <button
                                type="button"
                                class="btn btn--ghost"
                                on:click={resetAdvancedSettings}
                                disabled={savingAdvanced}
                            >
                                {t("settingsResetAdvanced")}
                            </button>
                        {/if}
                        <button
                            type="button"
                            class="btn"
                            class:btn--primary={!unsafeConfirmActive}
                            class:btn--danger={unsafeConfirmActive}
                            on:click={() => handleBasicSave()}
                            disabled={savingBasic}
                        >
                            {basicSaveLabel}
                        </button>
                        {#if showAiForm && activeProviderId.startsWith("openai-custom-")}
                            <button
                                type="button"
                                class="btn btn--ghost"
                                on:click={removeActiveCustom}
                            >
                                {t("settingsDeleteCustom")}
                            </button>
                        {/if}
                    </div>
                    {#if displayedStatusBanner}
                        <div class="settings__status-row">
                            <span
                                class="settings__status"
                                class:settings__status--ok={displayedStatusBanner.tone ===
                                    "ok"}
                                class:settings__status--error={displayedStatusBanner.tone ===
                                    "error"}
                                class:settings__status--info={displayedStatusBanner.tone ===
                                    "info"}
                            >
                                {displayedStatusBanner.text}
                            </span>
                        </div>
                    {/if}
                </form>

                <div class="settings__custom">
                    <p>{t("settingsAddCustomTitle")}</p>
                    <div class="settings__custom-grid">
                        <label class="settings__field">
                            <span>{t("settingsCustomSuffix")}</span>
                            <input
                                type="text"
                                placeholder={t("settingsCustomSuffixPlaceholder")}
                                bind:value={customSuffix}
                            />
                        </label>
                        <label class="settings__field">
                            <span>Base URL</span>
                            <input
                                type="text"
                                placeholder="https://api.openai.com/v1"
                                bind:value={customBaseUrl}
                            />
                        </label>
                        <button
                            type="button"
                            class="btn btn--ghost"
                            on:click={addCustomProvider}
                        >
                            {t("settingsAddCustom")}
                        </button>
                    </div>
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

    .settings__form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .settings__field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.95rem;
    }

    .settings__field--inline {
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
    }

    .settings__value {
        display: inline-flex;
        align-items: center;
        padding: 0.35rem 0.65rem;
        border-radius: var(--radius-sm);
        background-color: var(
            --color-surface-card,
            rgba(0, 0, 0, 0.04)
        );
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
        font-size: 0.95rem;
    }

    .settings__field input,
    .settings__field select {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: 0.6rem 0.75rem;
        background-color: var(--color-surface-card, rgba(0, 0, 0, 0.04));
        color: inherit;
        font: inherit;
    }

    .settings__field textarea {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: 0.6rem 0.75rem;
        background-color: var(--color-surface-card, rgba(0, 0, 0, 0.04));
        color: inherit;
        font: inherit;
        min-height: 120px;
        resize: vertical;
    }

    .settings__field select {
        appearance: none;
    }

    .settings__model-row {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        align-items: center;
    }

    .settings__model-row select {
        flex: 1 1 200px;
        min-width: 160px;
    }

    .settings__advanced-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 0.5rem;
    }

    .settings__actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    .settings__actions--inline {
        gap: 0.5rem;
    }

    .settings__status-row {
        margin-top: 0.35rem;
    }

    .settings__status {
        font-size: 0.85rem;
    }

    .settings__status--ok {
        color: var(--color-success, #1b874a);
    }

    .settings__status--error {
        color: var(--color-danger, #d64545);
    }

    .settings__status--info {
        color: var(--color-text-muted);
    }

    .settings__hint {
        font-size: 0.8rem;
        color: var(--color-text-muted);
    }

    .settings__custom {
        margin-top: 1rem;
        border-top: 1px solid var(--color-border);
        padding-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .settings__custom-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.75rem;
        align-items: end;
    }

    .settings__placeholder {
        padding: 0.85rem;
        border-radius: var(--radius-sm);
        background-color: var(--color-surface-card, rgba(0, 0, 0, 0.04));
        color: var(--color-text-muted);
        font-size: 0.9rem;
    }
</style>
