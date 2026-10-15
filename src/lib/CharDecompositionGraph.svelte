<script lang="ts">
  import {
    getColor,
    applyPartColor,
    applyFillColor,
    softenColor,
    fetchCharacterSvg,
    type PartPaint
  } from './utils';

  export interface Props {
    char: string;
    parts: string;
    class?: string;
    imageStyle?: string;
    charStyle?: string;
    /** 速成 uses only the first and last part. */
    endsOnly?: boolean;
    /** Omit the gap above the part letters. Used by the fixed typing preview. */
    compact?: boolean;
    /**
     * When set, paint only these parts. Omit the prop to keep the lookup-page
     * behavior of coloring every part (or the two ends when endsOnly is set).
     */
    litParts?: PartPaint[];
    /** Next part to show before it is typed. */
    hintPart?: PartPaint | null;
    /** 提示 pulses that part. 正常 holds it still. */
    pulseHint?: boolean;
    /** Practice hides the radical letters so the shape is the hint, not the name. */
    showLetters?: boolean;
    /** Confirmed parts keep their hue at a lower strength, so the active part stays dominant. */
    dimLit?: boolean;
  }

  let {
    char,
    parts,
    class: className = '',
    charStyle,
    imageStyle,
    endsOnly = false,
    compact = false,
    litParts,
    hintPart = null,
    pulseHint = false,
    showLetters = true,
    dimLit = false
  }: Props = $props();

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
    group.dataset.tone = '';
    group.querySelectorAll('path').forEach((path) => {
      (path as SVGPathElement).style.fill = mutedFill;
    });
  };

  const hidePart = (group: HTMLElement) => {
    group.style.opacity = '0';
    group.style.filter = '';
    group.style.fill = '';
    group.dataset.tone = '';
    group.querySelectorAll('path').forEach((path) => {
      (path as SVGPathElement).style.fill = '';
    });
  };

  const paintOne = (
    group: HTMLElement,
    colorIndex: number,
    state: 'lit' | 'hint',
    dim = false,
    pulse = false
  ) => {
    group.style.opacity = '1';
    if (dim) applyFillColor(group, softenColor(getColor(colorIndex)));
    else applyPartColor(group, colorIndex);
    group.classList.toggle('part-hint', pulse);
    group.dataset.state = state;
    group.dataset.tone = dim ? 'soft' : 'full';
  };

  const paintParts = (svg: SVGElement) => {
    svg.style.display = 'block';
    svg.style.width = '100%';
    svg.style.height = '100%';
    const progressive = litParts !== undefined;

    svg.querySelectorAll('g[id^="part-"]').forEach((group) => {
      const htmlGroup = group as HTMLElement;
      htmlGroup.classList.remove('part-hint');
      const partNumber = parseInt(htmlGroup.id.replace('part-', ''));

      if (partNumber === 0) {
        htmlGroup.style.opacity = '0.1';
        htmlGroup.style.filter = '';
        htmlGroup.style.fill = '';
        htmlGroup.dataset.state = 'base';
        return;
      }

      const partIndex = partNumber - 1;

      if (progressive) {
        const lit = litParts?.find((part) => part.partIndex === partIndex);
        const hint = hintPart && hintPart.partIndex === partIndex && !lit ? hintPart : null;
        if (lit) paintOne(htmlGroup, lit.colorIndex, 'lit', dimLit);
        else if (hint) paintOne(htmlGroup, hint.colorIndex, 'hint', false, pulseHint);
        else {
          hidePart(htmlGroup);
          htmlGroup.dataset.state = 'hidden';
        }
        return;
      }

      if (partIndex < 5 && isHighlighted(partIndex)) {
        paintOne(htmlGroup, displayColorIndex(partIndex), 'lit');
      } else {
        mutePart(htmlGroup);
        htmlGroup.dataset.state = 'muted';
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

    // eslint-disable-next-line svelte/no-dom-manipulating
    svgContainer.innerHTML = '';
    svgElement = null;
    loadedChar = '';

    try {
      const response = await fetchCharacterSvg(character);
      if (id !== requestId) return;
      if (!response.ok) {
        console.error(`Failed to load combined SVG for ${character}`);
        // eslint-disable-next-line svelte/no-dom-manipulating
        svgContainer.innerHTML = '<p class="text-gray-500 text-center">x</p>';
        return;
      }

      const svgText = await response.text();
      if (id !== requestId) return;
      // eslint-disable-next-line svelte/no-dom-manipulating
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
        // eslint-disable-next-line svelte/no-dom-manipulating
        svgContainer.innerHTML = '<p class="text-gray-500 text-center">Error loading SVG</p>';
      }
    }
  }

  $effect(() => {
    const paintKey = [
      endsOnly,
      parts,
      hintPart ? `${hintPart.partIndex}:${hintPart.colorIndex}` : '',
      pulseHint ? 'pulse' : 'still',
      dimLit ? 'dim' : 'vivid',
      (litParts ?? []).map((part) => `${part.partIndex}:${part.colorIndex}`).join(',')
    ].join('|');
    void paintKey;
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
  {#if showLetters}
    <div class="flex flex-nowrap items-center justify-center {compact ? '' : 'mt-4'}">
      {#each letterEntries as { c, i, colorIndex } (i)}
        <div
          class="text-2xl mx-2 {compact ? '' : 'mt-4'}"
          style={`color: ${getColor(colorIndex)};${charStyle ? charStyle : ''}`}
        >
          {c}
        </div>
      {/each}
    </div>
  {/if}
</div>
