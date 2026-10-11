<script lang="ts">
  import { getColor, applyPartColor, fetchCharacterSvg } from './utils';

  export interface Props {
    char: string;
    parts: string;
    class?: string;
    imageStyle?: string;
    charStyle?: string;
    /** 速成 uses only the first and last part. */
    endsOnly?: boolean;
  }

  let { char, parts, class: className = '', charStyle, imageStyle, endsOnly = false }: Props =
    $props();

  const mutedFill = '#d1d5db';

  const letterEntries = $derived.by(() => {
    const entries = parts.split('').map((c, i) => ({ c, i, colorIndex: i }));
    if (endsOnly && entries.length > 2) {
      return [
        { ...entries[0], colorIndex: 0 },
        { ...entries[entries.length - 1], colorIndex: 1 }
      ];
    }
    return entries;
  });

  const displayColorIndex = (colorIndex: number) => {
    if (endsOnly && parts.length > 2 && colorIndex === parts.length - 1) return 1;
    return colorIndex;
  };

  const isHighlighted = (colorIndex: number) => {
    if (!endsOnly || parts.length <= 2) return true;
    return colorIndex === 0 || colorIndex === parts.length - 1;
  };

  let svgContainer: HTMLDivElement;
  let svgElement: SVGElement | null = null;
  let loadedChar = '';
  let requestId = 0;

  const mutePart = (group: HTMLElement) => {
    group.style.opacity = '1';
    group.style.filter = '';
    group.style.fill = mutedFill;
    group.querySelectorAll('path').forEach((path) => {
      (path as SVGPathElement).style.fill = mutedFill;
    });
  };

  const paintParts = (svg: SVGElement) => {
    svg.style.width = '100%';
    svg.style.height = '100%';

    svg.querySelectorAll('g[id^="part-"]').forEach((group) => {
      const htmlGroup = group as HTMLElement;
      const partNumber = parseInt(htmlGroup.id.replace('part-', ''));

      if (partNumber === 0) {
        htmlGroup.style.opacity = '0.1';
        htmlGroup.style.filter = '';
        htmlGroup.style.fill = '';
        return;
      }

      const colorIndex = partNumber - 1;
      if (colorIndex < 5 && isHighlighted(colorIndex)) {
        htmlGroup.style.opacity = '1';
        applyPartColor(htmlGroup, displayColorIndex(colorIndex));
      } else {
        mutePart(htmlGroup);
      }
    });
  };

  async function loadCombinedSVG(character: string) {
    if (!svgContainer) return;

    const id = ++requestId;
    if (svgElement && loadedChar === character) {
      paintParts(svgElement);
      return;
    }

    svgContainer.innerHTML = '';
    svgElement = null;
    loadedChar = '';

    try {
      const response = await fetchCharacterSvg(character);
      if (id !== requestId) return;
      if (!response.ok) {
        console.error(`Failed to load combined SVG for ${character}`);
        svgContainer.innerHTML = '<p class="text-gray-500 text-center">x</p>';
        return;
      }

      const svgText = await response.text();
      if (id !== requestId) return;
      svgContainer.innerHTML = svgText;

      svgElement = svgContainer.querySelector('svg');
      if (!svgElement) {
        console.error(`No SVG element found in combined.svg for ${character}`);
        return;
      }

      loadedChar = character;
      paintParts(svgElement);
    } catch (error) {
      console.error(`Error loading combined SVG for ${character}:`, error);
      if (svgContainer && id === requestId) {
        svgContainer.innerHTML = '<p class="text-gray-500 text-center">Error loading SVG</p>';
      }
    }
  }

  $effect(() => {
    void endsOnly;
    void parts;
    if (char && svgContainer) {
      loadCombinedSVG(char);
    }
  });
</script>

<div class={className}>
  <div class="flex w-full items-center justify-center">
    <figure class="relative flex w-full items-center justify-center">
      <!-- Container for the combined SVG -->
      <div
        bind:this={svgContainer}
        class="w-full h-full"
        style={imageStyle ? imageStyle : ''}
      ></div>
    </figure>
  </div>
  <div class="flex flex-nowrap items-center justify-center">
    {#each letterEntries as { c, i, colorIndex } (i)}
      <div
        class="text-2xl mt-4 mx-2"
        style={`color: ${getColor(colorIndex)};${charStyle ? charStyle : ''}`}
      >
        {c}
      </div>
    {/each}
  </div>
</div>
