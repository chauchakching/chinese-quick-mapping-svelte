<script lang="ts">
  import { getColor, getColorFilter } from './utils';

  export let char: string;
  export let parts: string;
</script>

<figure class="relative mt-12" style="width: 270px; height: 192px;">
  <img
    src={`chars/${char}/part_0.svg`}
    class="w-full h-auto absolute opacity-10"
    alt={`${char}-0`}
  />
  {#each [0, 1, 2, 3, 4] as k}
    <img
      src={`chars/${char}/part_${k + 1}.svg`}
      class="w-full h-auto absolute"
      style={getColorFilter(k)}
      alt={`${char}-${k}`}
    />
  {/each}
</figure>
<div class="flex justify-center items-center">
  {#each parts.split('') as c, i}
    <div class="text-2xl mt-4 mb-12 mx-2" style={`color: ${getColor(i)};`}>{c}</div>
  {/each}
</div>
