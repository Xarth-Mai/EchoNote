<script lang="ts">
    export let as: keyof HTMLElementTagNameMap = "div";
    export let padding: "default" | "tight" = "default";
    export let shadow = false;
    export let flat = false;

    let className = "";
    let restProps: Record<string, unknown> = {};

    $: className = ($$props.class as string | undefined) ?? "";
    $: {
        const { class: _class, ...others } = $$restProps;
        restProps = others;
    }
</script>

<svelte:element
    this={as}
    class={["surface-card", className].filter(Boolean).join(" ")}
    class:surface-card--tight={padding === "tight"}
    class:surface-card--shadow={shadow}
    class:surface-card--flat={flat}
    {...restProps}
>
    <slot />
</svelte:element>
