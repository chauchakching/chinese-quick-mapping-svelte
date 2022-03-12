<script lang="ts">
  export let hasParts: boolean;
</script>

{#if hasParts}
  <button>
    <slot />
  </button>
{:else}
  <div>
    <slot />
  </div>
{/if}
