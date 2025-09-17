import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
}

const initialState: ToastState = {
  toasts: []
};

const { subscribe, update } = writable<ToastState>(initialState);

let toastIdCounter = 0;

/**
 * Show a toast message
 * @param message - The message to display
 * @param type - The type of toast (success, error, info, warning)
 * @param duration - How long to show the toast in milliseconds (default: 3000)
 */
export const showToast = (message: string, type: ToastType = 'info', duration = 3000) => {
  const id = `toast-${++toastIdCounter}`;
  const toast: Toast = { id, message, type, duration };

  update((state) => ({
    ...state,
    toasts: [...state.toasts, toast]
  }));

  // Auto-dismiss after duration
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
};

/**
 * Dismiss a specific toast
 */
export const dismissToast = (id: string) => {
  update((state) => ({
    ...state,
    toasts: state.toasts.filter((toast) => toast.id !== id)
  }));
};

/**
 * Clear all toasts
 */
export const clearAllToasts = () => {
  update((state) => ({
    ...state,
    toasts: []
  }));
};

export const toastStore = {
  subscribe
};
