<script lang="ts">
  import { onMount } from 'svelte';
  import { Calendar } from '../../components/Calendar';
  import { subscribe } from '../../utils/state';

  let container: HTMLDivElement;
  let calendar: Calendar | null = null;
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    calendar = new Calendar(container);
    unsubscribe = subscribe(() => {
      calendar?.update();
    });

    return () => {
      unsubscribe?.();
      calendar = null;
      if (container) {
        container.innerHTML = '';
      }
    };
  });
</script>

<div bind:this={container} class="h-full"></div>
