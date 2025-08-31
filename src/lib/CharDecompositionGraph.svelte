<script lang="ts">
  import { getColor, getColorFilter } from './utils';

  export interface Props {
    char: string;
    parts: string;
    class?: string;
    imageStyle?: string;
    charStyle?: string;
  }

  let { char, parts, class: className = '', charStyle, imageStyle }: Props = $props();
</script>

<div class={className}>
  <div class="flex justify-center items-center w-full h-full">
    <figure class="justify-center items-center relative">
      <img
        src={`chars/${char}/part_0.svg`}
        class="w-full h-full opacity-10"
        style={imageStyle ? imageStyle : ''}
        alt={`${char}-0`}
      />
      {#each [0, 1, 2, 3, 4] as k}
        <img
          src={`chars/${char}/part_${k + 1}.svg`}
          class="w-full h-full absolute top-0 left-0 mx-auto"
          style={`${getColorFilter(k)}; ${imageStyle ? imageStyle : ''}`}
          alt={`${char}-${k}`}
        />
      {/each}
    </figure>
  </div>
  <div class="flex justify-center items-center">
    {#each parts.split('') as c, i}
      <div class="text-2xl mt-4 mx-2" style={`color: ${getColor(i)};${charStyle ? charStyle : ''}`}>{c}</div>
    {/each}
  </div>
</div>