<script lang="ts">
  import { onMount } from 'svelte';
  import { Editor } from '../../components/Editor';
  import { subscribe } from '../../utils/state';

  let container: HTMLDivElement;
  let editor: Editor | null = null;
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    editor = new Editor(container);
    unsubscribe = subscribe(() => {
      editor?.update();
    });

    return () => {
      unsubscribe?.();
      editor = null;
      if (container) {
        container.innerHTML = '';
      }
    };
  });
</script>

<div bind:this={container} class="h-full"></div>
