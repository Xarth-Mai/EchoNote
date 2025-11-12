<script lang="ts">
    export let as: keyof HTMLElementTagNameMap = "div";
    export let align: "start" | "center" | "end" | "between" = "between";
    export let gap = "1rem";
    export let wrap = true;

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
    class={["toolbar", className].filter(Boolean).join(" ")}
    data-align={align}
    data-wrap={wrap ? "wrap" : "nowrap"}
    style={`--toolbar-gap: ${gap};`}
    {...restProps}
>
    <slot />
</svelte:element>

<style lang="scss">
    @use "../../styles/mixins.scss" as mixins;

    .toolbar {
        @include mixins.flex-row-between(var(--toolbar-gap, 1rem));
    }

    .toolbar[data-wrap="nowrap"] {
        flex-wrap: nowrap;
    }

    .toolbar[data-align="start"] {
        justify-content: flex-start;
    }

    .toolbar[data-align="center"] {
        justify-content: center;
    }

    .toolbar[data-align="end"] {
        justify-content: flex-end;
    }

    .toolbar[data-align="between"] {
        justify-content: space-between;
    }
</style>
