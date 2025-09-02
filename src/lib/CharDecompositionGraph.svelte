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

  let svgContainer: HTMLDivElement;
  let svgElement: SVGElement | null = null;

  async function loadCombinedSVG(character: string) {
    if (!svgContainer) return;

    try {
      const response = await fetch(`chars/${character}/combined.svg`);
      if (!response.ok) {
        console.error(`Failed to load combined SVG for ${character}`);
        svgContainer.innerHTML = '<p class="text-gray-500 text-center">Combined SVG not found</p>';
        return;
      }

      const svgText = await response.text();
      svgContainer.innerHTML = svgText;

      svgElement = svgContainer.querySelector('svg');
      if (!svgElement) {
        console.error(`No SVG element found in combined.svg for ${character}`);
        return;
      }

      // Apply base styles to the SVG
      svgElement.style.width = '100%';
      svgElement.style.height = '100%';

      // Apply styles to each part group
      const partGroups = svgElement.querySelectorAll('g[id^="part-"]');

      partGroups.forEach((group, index) => {
        const htmlGroup = group as HTMLElement;
        const partId = htmlGroup.id;
        const partNumber = parseInt(partId.replace('part-', ''));

        if (partNumber === 0) {
          // Part 0 is the background - low opacity
          htmlGroup.style.opacity = '0.1';
        } else {
          // Parts 1-5 get color filters
          const colorIndex = partNumber - 1; // Convert to 0-based index for color array
          if (colorIndex < 5) {
            // Apply the CSS filter for this color
            const filter = getColorFilter(colorIndex);
            const filterValue = filter.replace('filter: ', '').replace(';', '');
            htmlGroup.style.filter = filterValue;
          }
        }
      });
    } catch (error) {
      console.error(`Error loading combined SVG for ${character}:`, error);
      if (svgContainer) {
        svgContainer.innerHTML = '<p class="text-gray-500 text-center">Error loading SVG</p>';
      }
    }
  }

  // React to character changes
  $effect(() => {
    if (char && svgContainer) {
      loadCombinedSVG(char);
    }
  });
</script>

<div class={className}>
  <div class="flex justify-center items-center w-full h-full">
    <figure class="justify-center items-center relative">
      <!-- Container for the combined SVG -->
      <div
        bind:this={svgContainer}
        class="w-full h-full"
        style={imageStyle ? imageStyle : ''}
      ></div>
    </figure>
  </div>
  <div class="flex justify-center items-center">
    {#each parts.split('') as c, i (i)}
      <div class="text-2xl mt-4 mx-2" style={`color: ${getColor(i)};${charStyle ? charStyle : ''}`}>
        {c}
      </div>
    {/each}
  </div>
</div>
