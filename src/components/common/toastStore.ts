import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push(tone: ToastTone, message: string): void;
  dismiss(id: number): void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push(tone, message) {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-3), { id, tone, message }] });
    setTimeout(() => get().dismiss(id), tone === 'error' ? 7000 : 3500);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  info: (message: string) => useToastStore.getState().push('info', message),
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
};
