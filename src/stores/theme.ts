import { defineStore } from "pinia";
import { ipc } from "@/ipc/ipc";
import type { ThemeMeta, ThemeSource } from "@/ipc/types";
import { builtinThemes } from "@/themes/manifest";
import type { ThemeBundle } from "@/lib/theme-engine";
import { useSiteStore } from "./site";
import { useUiStore } from "./ui";

interface State {
  builtinMetas: ThemeMeta[];
  customMetas: ThemeMeta[];
  /** 当前站点的活动主题(含文件,用于构建与预览) */
  activeBundle: ThemeBundle | null;
  /** 主题制作器正在编辑的主题 */
  editing: { id: string; name: string; files: Record<string, string> } | null;
  editingActiveFile: string;
  loading: boolean;
}

export const useThemeStore = defineStore("theme", {
  state: (): State => ({
    builtinMetas: builtinThemes.map((t) => t.meta),
    customMetas: [],
    activeBundle: null,
    editing: null,
    editingActiveFile: "templates/layout.hbs",
    loading: false,
  }),

  getters: {
    activeMeta(state): ThemeMeta | undefined {
      const site = useSiteStore();
      const id = site.config?.theme.id;
      const pool =
        site.config?.theme.source === "custom" ? state.customMetas : state.builtinMetas;
      return pool.find((m) => m.id === id) ?? state.builtinMetas[0];
    },
    configValues(): Record<string, string | number | boolean> {
      const site = useSiteStore();
      const values = site.config?.theme.config ?? {};
      const meta = this.activeMeta;
      if (!meta) return {};
      const merged: Record<string, string | number | boolean> = {};
      for (const f of meta.config ?? []) {
        merged[f.key] = values[f.key] ?? f.default ?? "";
      }
      return merged;
    },
  },

  actions: {
    reset() {
      this.$reset();
    },

    async loadAll() {
      this.loading = true;
      try {
        this.customMetas = await ipc.listCustomThemes();
        await this.ensureActiveBundle();
      } finally {
        this.loading = false;
      }
    },

    async ensureActiveBundle(): Promise<ThemeBundle> {
      const site = useSiteStore();
      const ref = site.config?.theme ?? { id: "plain-light", source: "builtin" as ThemeSource, config: {} };
      let bundle: ThemeBundle | undefined;
      if (ref.source === "custom") {
        const files = await ipc.readThemeFiles(ref.id);
        const meta = this.customMetas.find((m) => m.id === ref.id);
        if (meta && files["templates/layout.hbs"]) {
          bundle = { meta, files };
        }
      }
      if (!bundle) {
        bundle = builtinThemes.find((t) => t.meta.id === ref.id) ?? builtinThemes[0];
      }
      this.activeBundle = bundle;
      return bundle;
    },

    async selectTheme(id: string, source: ThemeSource) {
      const site = useSiteStore();
      await site.saveConfig({ theme: { id, source, config: {} } });
      await this.loadAll();
    },

    /** 配置面板即时生效并持久化到站点配置 */
    async setConfigValue(key: string, value: string | number | boolean) {
      const site = useSiteStore();
      if (!site.config) return;
      const config = { ...site.config.theme.config, [key]: value };
      site.config = { ...site.config, theme: { ...site.config.theme, config } };
      await ipc.saveSiteConfig({ theme: { ...site.config.theme, config } });
    },

    async startEditing(id: string, source: ThemeSource) {
      let files: Record<string, string>;
      let meta: ThemeMeta | undefined;
      if (source === "custom") {
        files = await ipc.readThemeFiles(id);
        meta = this.customMetas.find((m) => m.id === id);
      } else {
        const builtin = builtinThemes.find((t) => t.meta.id === id);
        files = builtin ? { ...builtin.files } : {};
        meta = builtin?.meta;
      }
      if (!files["templates/layout.hbs"]) return;
      this.editing = { id, name: meta?.name ?? id, files };
      this.editingActiveFile = "templates/layout.hbs";
    },

    setEditingFile(path: string, content: string) {
      if (!this.editing) return;
      this.editing = { ...this.editing, files: { ...this.editing.files, [path]: content } };
    },

    async saveEditing() {
      if (!this.editing) return;
      const meta = this.customMetas.find((m) => m.id === this.editing!.id);
      if (!meta) return;
      await ipc.saveThemeFiles(this.editing.id, this.editing.files);
      // theme.json 可能被编辑,重新读取元数据
      await this.loadAll();
      await this.startEditing(this.editing.id, "custom");
    },

    async createFrom(baseSource: ThemeSource, baseId: string, name: string) {
      const ui = useUiStore();
      // 汇集基础主题文件,由 Rust 落盘为新主题(mock 同样支持)
      let files: Record<string, string>;
      if (baseSource === "custom") {
        files = await ipc.readThemeFiles(baseId);
      } else {
        const builtin = builtinThemes.find((t) => t.meta.id === baseId);
        files = builtin ? { ...builtin.files } : {};
      }
      if (!files["templates/layout.hbs"]) {
        throw new Error("基础主题缺少模板文件");
      }
      const meta = await ipc.createCustomTheme(name, files);
      await this.loadAll();
      ui.toast(`「${name}」已创建`, "success");
      return meta;
    },

    async deleteCustom(id: string) {
      const site = useSiteStore();
      await ipc.deleteTheme(id);
      if (site.config?.theme.source === "custom" && site.config.theme.id === id) {
        await this.selectTheme("plain-light", "builtin");
      }
      await this.loadAll();
    },

    async importZip(zipPath: string) {
      const ui = useUiStore();
      const meta = await ipc.importThemeZip(zipPath);
      await this.loadAll();
      ui.toast(`「${meta.name}」已导入`, "success");
      return meta;
    },

    async exportEditing(destPath: string) {
      if (!this.editing) return;
      await ipc.exportThemeZip(this.editing.files, destPath);
    },

    async exportBuiltin(id: string, destPath: string) {
      const builtin = builtinThemes.find((t) => t.meta.id === id);
      if (builtin) await ipc.exportThemeZip(builtin.files, destPath);
    },
  },
});
