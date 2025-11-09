<script lang="ts">
  import { onMount } from 'svelte';
  import { Timeline } from '../../components/Timeline';
  import { subscribe } from '../../utils/state';

  let container: HTMLDivElement;
  let timeline: Timeline | null = null;
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    timeline = new Timeline(container);
    unsubscribe = subscribe(() => {
      timeline?.update();
    });

    return () => {
      unsubscribe?.();
      timeline = null;
      if (container) {
        container.innerHTML = '';
      }
    };
  });
</script>

<div bind:this={container} class="h-full"></div>
