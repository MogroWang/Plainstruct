import { defineStore } from "pinia";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

export interface ConfirmState {
  title: string;
  body: string;
  danger?: boolean;
  confirmText?: string;
}

interface State {
  toasts: Toast[];
  confirm: ConfirmState | null;
}

let toastId = 0;
let confirmResolver: ((ok: boolean) => void) | null = null;

export const useUiStore = defineStore("ui", {
  state: (): State => ({
    toasts: [],
    confirm: null,
  }),

  actions: {
    toast(text: string, kind: ToastKind = "info") {
      const id = ++toastId;
      this.toasts.push({ id, kind, text });
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
      }, 2600);
    },

    /** 弹出确认框,返回用户选择 */
    confirmDialog(opts: ConfirmState): Promise<boolean> {
      this.confirm = opts;
      return new Promise((resolve) => {
        confirmResolver = resolve;
      });
    },

    resolveConfirm(ok: boolean) {
      confirmResolver?.(ok);
      confirmResolver = null;
      this.confirm = null;
    },
  },
});
