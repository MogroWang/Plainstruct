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

/** 结算当前未决的确认框(有新框覆盖或用户选择时调用) */
function settleConfirm(ok: boolean) {
  confirmResolver?.(ok);
  confirmResolver = null;
}

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
      // 新确认框覆盖旧的:被覆盖的未决调用以「取消」收尾,避免 Promise 永不 resolve
      settleConfirm(false);
      this.confirm = opts;
      return new Promise((resolve) => {
        confirmResolver = resolve;
      });
    },

    resolveConfirm(ok: boolean) {
      settleConfirm(ok);
      this.confirm = null;
    },
  },
});
