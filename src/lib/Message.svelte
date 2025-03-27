<script lang="ts">
  import { run } from 'svelte/legacy';

  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  const MESSAGE_TOP_OFFSET = 25;
  const MESSAGE_DURATION_MILLISECOND = 2000;

  const notypecheck = (x: any) => x;

  const getY = () =>
    tweened(0, {
      duration: 250,
      easing: cubicOut
    });

  type Message = HTMLElement & {
    open: Function;
  };

  export interface Props {
    ele: HTMLElement;
    children?: import('svelte').Snippet;
  }

  let { ele = $bindable(), children }: Props = $props();

  let visibleTimer: ReturnType<typeof setTimeout> | null = $state(null);
  let y = $state(getY());

  run(() => {
    if (ele) {
      (ele as Message).open = () => {
        // previou timer still here, reset
        if (visibleTimer) {
          y = getY();
          clearTimeout(visibleTimer);
        }

        y.set(ele.offsetHeight + MESSAGE_TOP_OFFSET);
        visibleTimer = setTimeout(() => {
          y.set(0);
          visibleTimer = null;
        }, MESSAGE_DURATION_MILLISECOND);
      };
      console.log('ele with open()', ele);
    }
  });
</script>

<div
  bind:this={ele}
  class="fixed left-1/2 bg-white py-2 px-4 border border-solid border-slate-100 rounded-3xl drop-shadow"
  style={`transform: translate(-50%, -100%); top: ${$y}px`}
>
  {@render children?.()}
</div>
