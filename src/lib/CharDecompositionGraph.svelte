<script lang="ts">
  export let char: string;
  export let parts: string;

  const charColors = [
    // blue
    '#423BE0',
    // orange
    '#DB993D',
    // green1
    '#63E7F0',
    // green2
    '#1E9423',
    // red
    '#E31B36'
  ];
</script>

<button class="hidden bg-white rounded flex flex-col items-center justify-center">
  <figure class="relative mt-12" style="width: 270px; height: 192px;">
    {#each [0, 1, 2, 3, 4, 5] as k}
      <img
        src={`static/chars/${char}/part_${k}.svg`}
        class="w-full h-auto absolute opacity-10"
        alt={`${char}-${k}`}
      />
    {/each}
  </figure>
  <div class="flex justify-center items-center">
    {#each parts.split('') as c, i}
      <div class="text-2xl mt-4 mb-12 mx-2" style={`color: ${charColors[i]};`}>{c}</div>
    {/each}
  </div>
</button>
