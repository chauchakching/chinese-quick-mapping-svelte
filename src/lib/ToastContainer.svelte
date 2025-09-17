<script lang="ts">
  import { toastStore, dismissToast, type ToastType } from './toast';

  const MESSAGE_TOP_OFFSET = 10;
  const TOAST_HEIGHT = 60;

  // Subscribe to toast store
  let toasts = $derived(toastStore);

  // Get icon and colors for different toast types
  const getToastConfig = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          icon: '/icons/check.svg',
          iconFilter:
            'invert(59%) sepia(70%) saturate(487%) hue-rotate(89deg) brightness(90%) contrast(94%)',
          bgClass: 'bg-white border-green-200 text-green-700'
        };
      case 'error':
        return {
          icon: '/icons/trash.svg', // Using available icon as placeholder
          iconFilter:
            'invert(20%) sepia(95%) saturate(3543%) hue-rotate(349deg) brightness(90%) contrast(94%)',
          bgClass: 'bg-white border-red-200 text-red-700'
        };
      case 'warning':
        return {
          icon: '/icons/fire.svg',
          iconFilter:
            'invert(66%) sepia(95%) saturate(1543%) hue-rotate(9deg) brightness(90%) contrast(94%)',
          bgClass: 'bg-white border-yellow-200 text-yellow-700'
        };
      case 'info':
      default:
        return {
          icon: '/icons/link.svg',
          iconFilter:
            'invert(40%) sepia(95%) saturate(1543%) hue-rotate(200deg) brightness(90%) contrast(94%)',
          bgClass: 'bg-white border-blue-200 text-blue-700'
        };
    }
  };

  // Track visible toasts with their animated positions
  let visibleToasts = $state<
    Array<{ id: string; message: string; type: ToastType; y: number; visible: boolean }>
  >([]);

  $effect(() => {
    // Handle toast additions and removals
    const currentToasts = $toasts.toasts;

    // Add new toasts
    currentToasts.forEach((toast, index) => {
      const existing = visibleToasts.find((v) => v.id === toast.id);
      if (!existing) {
        const newToast = {
          id: toast.id,
          message: toast.message,
          type: toast.type,
          y: 0,
          visible: false
        };
        visibleToasts.push(newToast);

        // Animate in
        setTimeout(() => {
          const toastIndex = visibleToasts.findIndex((v) => v.id === toast.id);
          if (toastIndex >= 0) {
            visibleToasts[toastIndex].y = TOAST_HEIGHT + MESSAGE_TOP_OFFSET;
            visibleToasts[toastIndex].visible = true;
          }
        }, 10);
      }
    });

    // Remove toasts that are no longer in the store
    visibleToasts.forEach((visibleToast, index) => {
      if (!currentToasts.find((t) => t.id === visibleToast.id)) {
        visibleToasts[index].y = 0;
        visibleToasts[index].visible = false;

        // Remove from array after animation
        setTimeout(() => {
          const toastIndex = visibleToasts.findIndex((v) => v.id === visibleToast.id);
          if (toastIndex >= 0) {
            visibleToasts.splice(toastIndex, 1);
          }
        }, 250);
      }
    });
  });

  const handleDismiss = (id: string) => {
    const toastIndex = visibleToasts.findIndex((v) => v.id === id);
    if (toastIndex >= 0) {
      visibleToasts[toastIndex].y = 0;
      visibleToasts[toastIndex].visible = false;

      setTimeout(() => {
        dismissToast(id);
      }, 250);
    }
  };
</script>

{#each visibleToasts as toast (toast.id)}
  {@const config = getToastConfig(toast.type)}
  <div
    class="fixed left-1/2 py-2 px-4 border border-solid rounded-3xl drop-shadow-md cursor-pointer z-50 transition-all duration-250 ease-out {config.bgClass}"
    style="transform: translate(-50%, -100%); top: {toast.y}px; opacity: {toast.visible ? 1 : 0};"
    onclick={() => handleDismiss(toast.id)}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Enter' && handleDismiss(toast.id)}
  >
    <div class="flex justify-center items-center">
      <img
        src={config.icon}
        alt="{toast.type} icon"
        class="h-4 w-4 mr-2"
        style="filter: {config.iconFilter}"
      />
      <span>{toast.message}</span>
    </div>
  </div>
{/each}
