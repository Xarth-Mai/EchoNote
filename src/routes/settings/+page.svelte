<script lang="ts">
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { appStateStore, setTheme } from "$utils/state";
    import { listAiModels } from "$utils/backend";
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

    const state = appStateStore;
    const themes: Array<{ label: string; value: "auto" | "light" | "dark" }> = [
        { label: "跟随系统", value: "auto" },
        { label: "浅色", value: "light" },
        { label: "深色", value: "dark" },
    ];

    const BUILTIN_ORDER: Record<string, number> = {
        chatgpt: 0,
        deepseek: 1,
    };

    let aiState: AiSettingsState = sanitizeState(loadAiSettingsState());
    let activeProviderId: AiProviderId = aiState.activeProviderId;
    let providerOptions: AiProviderConfig[] = [];
    let currentProvider: AiProviderConfig = getCurrentProvider();
    let providerModels: Partial<Record<AiProviderId, string[]>> = {};
    let formBaseUrl = "";
    let formApiKey = "";
    let formModel = "";
    let formPrompt = DEFAULT_AI_PROMPT;
    let formTemperature = String(DEFAULT_TEMPERATURE);
    let formMaxTokens = String(getDefaultMaxTokens(activeProviderId));
    let statusBanner: { text: string; tone: "ok" | "error" } | null = null;
    let savingAi = false;
    let loadingModels = false;
    let customSuffix = "";
    let customBaseUrl = "";
    let modelOptions: string[] = [];
    let advancedOpen = false;

    $: aiState = sanitizeState(aiState);
    $: {
        if (!aiState.providers[activeProviderId]) {
            activeProviderId = "chatgpt";
            aiState.activeProviderId = "chatgpt";
        }
    }
    $: providerOptions = Object.values(aiState.providers).sort((a, b) => {
        const orderA = BUILTIN_ORDER[a.id] ?? 10;
        const orderB = BUILTIN_ORDER[b.id] ?? 10;
        if (orderA !== orderB) return orderA - orderB;
        return a.label.localeCompare(b.label);
    });
    $: syncFormWithProvider();
    $: modelOptions =
        providerModels[activeProviderId] ?? (formModel ? [formModel] : []);

    function getCurrentProvider(): AiProviderConfig {
        return (
            aiState.providers[activeProviderId] ??
            Object.values(aiState.providers)[0] ??
            createCustomProviderConfig("default", "https://api.openai.com/v1")
        );
    }

    function syncFormWithProvider(): void {
        currentProvider = getCurrentProvider();
        const provider = currentProvider;
        formBaseUrl = provider.baseUrl;
        formApiKey = provider.apiKey ?? "";
        formModel = provider.model ?? "";
        formPrompt = provider.prompt ?? DEFAULT_AI_PROMPT;
        formTemperature = String(
            provider.temperature ?? DEFAULT_TEMPERATURE,
        );
        formMaxTokens = String(
            provider.maxTokens ?? getDefaultMaxTokens(provider.id),
        );
    }

    onMount(() => {
        syncFormWithProvider();
    });

    function normalizedBaseUrl(value: string): string {
        const trimmed = value.trim();
        return trimmed || "https://api.openai.com/v1";
    }

    function setActiveProvider(id: AiProviderId): void {
        if (!aiState.providers[id]) {
            return;
        }
        aiState.activeProviderId = id;
        activeProviderId = id;
        statusBanner = null;
        syncFormWithProvider();
    }

    async function fetchModels(): Promise<void> {
        if (!browser) return;
        const provider = getCurrentProvider();
        const apiKey = formApiKey.trim();
        if (!apiKey) {
            statusBanner = { tone: "error", text: "请先填写 API Key" };
            return;
        }
        loadingModels = true;
        statusBanner = null;
        const baseUrl = provider.editable
            ? normalizedBaseUrl(formBaseUrl)
            : provider.baseUrl;
        try {
            const models = await listAiModels({
                baseUrl,
                apiKey,
            });
            provider.baseUrl = baseUrl;
            provider.apiKey = apiKey;
            providerModels = {
                ...providerModels,
                [provider.id]: models,
            };
            if (models.length === 0) {
                statusBanner = { tone: "error", text: "未返回可用模型" };
            } else {
                if (!models.includes(formModel)) {
                    formModel = models[0];
                    provider.model = formModel;
                }
                statusBanner = {
                    tone: "ok",
                    text: `已识别 ${models.length} 个模型`,
                };
            }
        } catch (error) {
            console.error("拉取模型失败", error);
            statusBanner = { tone: "error", text: "无法获取模型，请检查配置" };
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
    }

    function handleApiKeyInput(event: Event): void {
        const value = (event.currentTarget as HTMLInputElement).value;
        formApiKey = value;
        const provider = getCurrentProvider();
        provider.apiKey = value;
    }

    function handleModelChange(event: Event): void {
        const value = (event.currentTarget as HTMLSelectElement).value;
        formModel = value;
        const provider = getCurrentProvider();
        provider.model = value;
    }

    function handlePromptInput(event: Event): void {
        const value = (event.currentTarget as HTMLTextAreaElement).value;
        formPrompt = value;
        const provider = getCurrentProvider();
        provider.prompt = value;
    }

    function handleTemperatureInput(event: Event): void {
        const value = (event.currentTarget as HTMLInputElement).value;
        formTemperature = value;
        const numeric = Number(value);
        const provider = getCurrentProvider();
        provider.temperature =
            Number.isFinite(numeric) && numeric >= 0 ? parseFloat(value) : undefined;
    }

    function handleMaxTokensInput(event: Event): void {
        const value = (event.currentTarget as HTMLInputElement).value;
        formMaxTokens = value;
        const numeric = Number(value);
        const provider = getCurrentProvider();
        provider.maxTokens =
            Number.isFinite(numeric) && numeric > 0
                ? Math.floor(numeric)
                : undefined;
    }

    function addCustomProvider(): void {
        const suffix = customSuffix.trim();
        if (!suffix) {
            statusBanner = { tone: "error", text: "请填写自定义名称后缀" };
            return;
        }
        const candidateId = `openai-custom-${suffix}` as AiProviderId;
        if (aiState.providers[candidateId]) {
            statusBanner = { tone: "error", text: "该后缀已存在，请更换" };
            return;
        }
        const provider = createCustomProviderConfig(
            suffix,
            customBaseUrl || normalizedBaseUrl(formBaseUrl),
        );
        aiState.providers[provider.id] = provider;
        customSuffix = "";
        customBaseUrl = "";
        statusBanner = { tone: "ok", text: "已添加自定义接口" };
        setActiveProvider(provider.id);
    }

    function removeActiveCustom(): void {
        if (!activeProviderId.startsWith("openai-custom-")) {
            statusBanner = {
                tone: "error",
                text: "仅可删除自定义接口",
            };
            return;
        }

        const nextProviders = { ...aiState.providers };
        delete nextProviders[activeProviderId];

        aiState = sanitizeState({
            activeProviderId: "chatgpt",
            providers: nextProviders as Record<AiProviderId, AiProviderConfig>,
        });
        activeProviderId = aiState.activeProviderId;
        providerModels = {};
        syncFormWithProvider();
        saveAiSettingsState(aiState);
        statusBanner = { tone: "ok", text: "已删除自定义接口" };
    }

    function resetAdvancedSettings(): void {
        const defaults = getDefaultMaxTokens(activeProviderId);
        formPrompt = DEFAULT_AI_PROMPT;
        formTemperature = String(DEFAULT_TEMPERATURE);
        formMaxTokens = String(defaults);
        const provider = getCurrentProvider();
        provider.prompt = DEFAULT_AI_PROMPT;
        provider.temperature = DEFAULT_TEMPERATURE;
        provider.maxTokens = defaults;
        statusBanner = { tone: "ok", text: "已恢复高级设置默认值" };
        setTimeout(() => {
            if (statusBanner?.tone === "ok") {
                statusBanner = null;
            }
        }, 2000);
    }

    async function handleAiSubmit(event: Event): Promise<void> {
        event.preventDefault();
        if (savingAi) return;
        const provider = getCurrentProvider();
        if (!formModel.trim()) {
            statusBanner = { tone: "error", text: "请选择模型类型" };
            return;
        }
        provider.baseUrl = provider.editable
            ? normalizedBaseUrl(formBaseUrl)
            : provider.baseUrl;
        provider.apiKey = formApiKey;
        provider.model = formModel;
        provider.prompt = formPrompt || DEFAULT_AI_PROMPT;
        provider.temperature =
            Number(formTemperature) || DEFAULT_TEMPERATURE;
        provider.maxTokens =
            Number(formMaxTokens) || getDefaultMaxTokens(activeProviderId);

        try {
            savingAi = true;
            saveAiSettingsState(aiState);
            statusBanner = { tone: "ok", text: "已保存" };
            setTimeout(() => {
                statusBanner = null;
            }, 2000);
        } catch (error) {
            console.error("保存 AI 设置失败", error);
            statusBanner = { tone: "error", text: "保存失败，请重试" };
        } finally {
            savingAi = false;
        }
    }
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
                <h2>AI 服务</h2>
                <p>选择提供商、配置凭据并设置默认模型。</p>
                <form class="settings__form" on:submit={handleAiSubmit}>
                    <label class="settings__field">
                        <span>API 类型</span>
                        <select
                            bind:value={activeProviderId}
                            on:change={handleProviderSelect}
                        >
                            {#each providerOptions as provider}
                                <option value={provider.id}>
                                    {provider.label}
                                </option>
                            {/each}
                        </select>
                    </label>

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
                                该提供商使用固定 Base URL
                            </small>
                        {:else}
                            <small class="settings__hint">
                                例如 https://api.openai.com/v1
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
                    </label>

                    <label class="settings__field">
                        <span>默认模型</span>
                        <div class="settings__model-row">
                            <select
                                bind:value={formModel}
                                on:change={handleModelChange}
                                disabled={modelOptions.length === 0}
                            >
                                {#if modelOptions.length === 0}
                                    <option value="">请先获取模型列表</option>
                                {/if}
                                {#each modelOptions as model}
                                    <option value={model}>{model}</option>
                                {/each}
                            </select>
                            <button
                                type="button"
                                class="btn btn--ghost"
                                on:click={fetchModels}
                                disabled={loadingModels || !formApiKey.trim()}
                            >
                                {loadingModels ? "拉取中..." : "刷新模型"}
                            </button>
                        </div>
                        {#if !formApiKey.trim()}
                            <small class="settings__hint">
                                填写 API Key 后可获取模型列表
                            </small>
                        {/if}
                    </label>

                    <div class="settings__advanced-toggle">
                        <span>高级设置</span>
                        <button
                            type="button"
                            class="btn btn--ghost"
                            on:click={() => (advancedOpen = !advancedOpen)}
                        >
                            {advancedOpen ? "隐藏" : "显示"}高级设置
                        </button>
                    </div>

                    {#if advancedOpen}
                        <label class="settings__field">
                            <span>自定义 Prompt</span>
                            <textarea
                                rows="4"
                                bind:value={formPrompt}
                                on:input={handlePromptInput}
                            ></textarea>
                            <small class="settings__hint">
                                默认为“{DEFAULT_AI_PROMPT}”。推理模型通常耗时高且价值有限，可沿用该提示词。
                            </small>
                        </label>

                        <label class="settings__field">
                            <span>温度（0-1）</span>
                            <input
                                type="number"
                                min="0"
                                max="2"
                                step="0.05"
                                placeholder="例如 0.3"
                                bind:value={formTemperature}
                                on:input={handleTemperatureInput}
                            />
                            <small class="settings__hint">
                                推荐值：Chat 模型约 0.3。温度越高越发散。
                            </small>
                        </label>

                        <label class="settings__field">
                            <span>最大输出 Tokens</span>
                            <input
                                type="number"
                                min="1"
                                placeholder="例如 60 或 2048"
                                bind:value={formMaxTokens}
                                on:input={handleMaxTokensInput}
                            />
                            <small class="settings__hint">
                                建议：Chat 模型约 60；推理模型约 2048（但多数场景并不值得启用推理模型）。
                            </small>
                        </label>
                    {/if}

                    <div class="settings__actions">
                        <button
                            type="submit"
                            class="btn btn--primary"
                            disabled={savingAi}
                        >
                            {savingAi ? "保存中..." : "保存配置"}
                        </button>
                        <button
                            type="button"
                            class="btn btn--ghost"
                            on:click={resetAdvancedSettings}
                        >
                            重置高级设置
                        </button>
                        {#if activeProviderId.startsWith("openai-custom-")}
                            <button
                                type="button"
                                class="btn btn--ghost"
                                on:click={removeActiveCustom}
                            >
                                删除当前自定义接口
                            </button>
                        {/if}
                        {#if statusBanner}
                            <span
                                class="settings__status"
                                class:settings__status--ok={statusBanner.tone ===
                                    "ok"}
                                class:settings__status--error={statusBanner.tone ===
                                    "error"}
                            >
                                {statusBanner.text}
                            </span>
                        {/if}
                    </div>
                </form>

                <div class="settings__custom">
                    <p>新增 OpenAI API Custom</p>
                    <div class="settings__custom-grid">
                        <label class="settings__field">
                            <span>自定义名称后缀</span>
                            <input
                                type="text"
                                placeholder="例如 team-a"
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
                            添加自定义接口
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

    .settings__status {
        font-size: 0.85rem;
    }

    .settings__status--ok {
        color: var(--color-success, #1b874a);
    }

    .settings__status--error {
        color: var(--color-danger, #d64545);
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

</style>
