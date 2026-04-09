<script lang="ts">
    import { onMount, createEventDispatcher } from "svelte";
    import { fade } from "svelte/transition";
    import { translator } from "$utils/i18n";

    export let selection: { text: string; from: number; to: number } | null = null;
    export let rect: { top: number; left: number; bottom: number; right: number } | null = null;

    const dispatch = createEventDispatcher<{
        action: { instruction: string };
        close: void;
    }>();

    const t = translator;

    let customInstruction = "";
    let menuRef: HTMLDivElement;

    const predefinedActions = [
        { id: "polish", icon: "✨", label: "editorAiPolish" },
        { id: "shorten", icon: "✂️", label: "editorAiShorten" },
        { id: "longer", icon: "📝", label: "editorAiLonger" },
        { id: "professional", icon: "💼", label: "editorAiProfessional" },
    ];

    function handleAction(instruction: string) {
        dispatch("action", { instruction });
    }

    function handleCustomSubmit(e: KeyboardEvent | MouseEvent) {
        if (e.type === "keydown" && (e as KeyboardEvent).key !== "Enter") return;
        if (!customInstruction.trim()) return;
        handleAction(customInstruction.trim());
        customInstruction = "";
    }

    onMount(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef && !menuRef.contains(e.target as Node)) {
                dispatch("close");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    });

    $: positionStyle = rect 
        ? `top: ${rect.top - 10}px; left: ${rect.left}px; transform: translate(0, -100%);`
        : "display: none;";
</script>

{#if selection}
    <div 
        bind:this={menuRef}
        class="ai-floating-menu surface-card surface-card--shadow"
        style={positionStyle}
        transition:fade={{ duration: 150 }}
    >
        <div class="ai-floating-menu__actions">
            {#each predefinedActions as action}
                <button 
                    class="ai-action-btn"
                    on:click={() => handleAction($t(action.label))}
                >
                    <span class="ai-action-btn__icon">{action.icon}</span>
                    <span class="ai-action-btn__label">{$t(action.label)}</span>
                </button>
            {/each}
        </div>
        
        <div class="ai-floating-menu__input">
            <input 
                type="text" 
                placeholder={$t("editorAiInputPlaceholder")}
                bind:value={customInstruction}
                on:keydown={handleCustomSubmit}
            />
            <button on:click={handleCustomSubmit}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            </button>
        </div>
    </div>
{/if}

<style>
    .ai-floating-menu {
        position: fixed;
        z-index: 2000;
        background: var(--color-surface, #fff);
        border: 1px solid var(--color-border, #e5e7eb);
        border-radius: var(--radius-lg, 12px);
        padding: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        min-width: 280px;
        box-shadow: var(--shadow-xl);
    }

    .ai-floating-menu__actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.25rem;
    }

    .ai-action-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        border: none;
        background: transparent;
        border-radius: var(--radius-md, 6px);
        cursor: pointer;
        font-size: 0.875rem;
        color: var(--color-text, #374151);
        text-align: left;
        transition: background 0.2s;
    }

    .ai-action-btn:hover {
        background: var(--color-surface-muted, #f3f4f6);
    }

    .ai-action-btn__icon {
        font-size: 1.125rem;
    }

    .ai-floating-menu__input {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        background: var(--color-surface-muted, #f3f4f6);
        border-radius: var(--radius-md, 6px);
        padding: 0.25rem 0.5rem;
    }

    .ai-floating-menu__input input {
        flex: 1;
        border: none;
        background: transparent;
        padding: 0.25rem;
        font-size: 0.875rem;
        outline: none;
    }

    .ai-floating-menu__input button {
        border: none;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        cursor: pointer;
        color: var(--color-primary, #3b82f6);
        border-radius: 4px;
    }

    .ai-floating-menu__input button:hover {
        background: rgba(0,0,0,0.05);
    }
</style>
