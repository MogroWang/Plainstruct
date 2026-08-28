import { defineStore } from "pinia";
import type { BuildReport } from "@/ipc/types";
import { buildSite } from "@/lib/builder";
import { buildIndexUrl } from "@/lib/preview";
import { useSiteStore } from "./site";
import { useThemeStore } from "./theme";
import { useAppStore } from "./app";
import { useUiStore } from "./ui";
import { i18n } from "@/i18n";

interface State {
  building: boolean;
  report: BuildReport | null;
  error: string | null;
  autoRebuild: boolean;
  /** 每次构建完成后自增,预览 iframe 以此刷新 */
  previewNonce: number;
}

let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

export const useBuilderStore = defineStore("builder", {
  state: (): State => ({
    building: false,
    report: null,
    error: null,
    autoRebuild: true,
    previewNonce: 0,
  }),

  actions: {
    reset() {
      if (rebuildTimer) clearTimeout(rebuildTimer);
      rebuildTimer = null;
      this.$reset();
    },

    async build() {
      const site = useSiteStore();
      const theme = useThemeStore();
      const ui = useUiStore();
      if (!site.config || this.building) return;
      this.building = true;
      this.error = null;
      try {
        const bundle = await theme.ensureActiveBundle();
        this.report = await buildSite(site.config, bundle);
        this.previewNonce++;
        // 独立预览窗口若开着,同步加载最新构建产物
        void this.refreshPreviewWindow();
      } catch (e) {
        this.error = ipcErr(e);
        ui.toast(this.error, "error");
      } finally {
        this.building = false;
      }
    },

    /**
     * 独立预览窗口:打开;已在则关闭重建以加载最新构建。
     * (静态站点页面没有脚本,无法远程触发刷新,只能重建窗口)
     */
    async openOrRefreshPreviewWindow() {
      const site = useSiteStore();
      const app = useAppStore();
      if (!site.root) return;
      try {
        const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        const existing = await WebviewWindow.getByLabel("site-preview");
        if (existing) {
          await existing.close();
          // 等 label 释放再重建,避免 "label already exists"
          for (let i = 0; i < 10; i++) {
            await new Promise((r) => setTimeout(r, 120));
            if (!(await WebviewWindow.getByLabel("site-preview"))) break;
          }
        }
        new WebviewWindow("site-preview", {
          url: buildIndexUrl(app.platform),
          title: `${site.config?.name ?? "Plainstruct"} · ${i18n.global.t("build.preview")}`,
          width: 1120,
          height: 760,
          center: true,
        });
      } catch {
        /* 非 Tauri 环境忽略 */
      }
    },

    /** 构建完成后刷新独立预览窗口(未打开则不动作) */
    async refreshPreviewWindow() {
      try {
        const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        const existing = await WebviewWindow.getByLabel("site-preview");
        if (existing) await this.openOrRefreshPreviewWindow();
      } catch {
        /* 非 Tauri 环境忽略 */
      }
    },

    /** 文档保存后:已构建过则防抖重建 */
    onDocSaved() {
      if (!this.autoRebuild || !this.report || this.building) return;
      if (rebuildTimer) clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(() => {
        void this.build();
      }, 700);
    },

    setAutoRebuild(v: boolean) {
      this.autoRebuild = v;
    },
  },
});

function ipcErr(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
}
