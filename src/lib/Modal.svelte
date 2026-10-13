<script lang="ts">
  export interface Props {
    visible: boolean;
    onClose: () => void;
    children?: import('svelte').Snippet;
  }

  let { visible, onClose, children }: Props = $props();

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }
</script>

<div
  class={`fixed z-30 w-full h-full left-0 top-0 p-8 flex items-center justify-center ${
    !visible ? 'pointer-events-none opacity-0' : ''
  }`}
  data-testid="modal"
  style="background-color: rgba(0, 0, 0, 0.4); transition: opacity 0.15s ease 0s;"
  onclick={() => onClose()}
  onkeydown={handleKeyDown}
  role="dialog"
  aria-modal={visible}
  tabindex="-1"
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class={`${visible ? '' : 'hidden '}rounded-2xl bg-white shadow-lg`}
    onclick={(event) => event.stopPropagation()}
    onkeydown={(event) => event.stopPropagation()}
    role="document"
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>
