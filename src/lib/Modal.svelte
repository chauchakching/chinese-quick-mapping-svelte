<script lang="ts">
  export let visible: boolean;
  export let onClose: () => void;
</script>

<div
  class={`fixed z-10 w-full h-full left-0 top-0 p-8 flex items-center justify-center ${
    !visible ? 'pointer-events-none opacity-0' : ''
  }`}
  data-testid="modal"
  style="background-color: rgba(0, 0, 0, 0.4); transition: opacity 0.15s ease 0s;"
  on:click={() => onClose()}
>
  <button
    class={`${visible ? '' : 'hidden '}bg-white rounded flex flex-col items-center justify-center`}
  >
    <slot />
  </button>
</div>
