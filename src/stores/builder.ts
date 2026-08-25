import { defineStore } from "pinia";
import type { BuildReport } from "@/ipc/types";
import { buildSite } from "@/lib/builder";
import { useSiteStore } from "./site";
import { useThemeStore } from "./theme";
import { useUiStore } from "./ui";

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
      } catch (e) {
        this.error = ipcErr(e);
        ui.toast(this.error, "error");
      } finally {
        this.building = false;
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
