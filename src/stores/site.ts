import { defineStore } from "pinia";
import { ipc } from "@/ipc/ipc";
import type { SiteConfig, TreeNode } from "@/ipc/types";
import { collectDocPaths, type DocsCache } from "@/lib/builder";
import { useEditorStore } from "./editor";
import { useBuilderStore } from "./builder";
import { useThemeStore } from "./theme";
import { usePublishStore } from "./publish";
import { useAppStore } from "./app";

interface State {
  open: boolean;
  root: string;
  config: SiteConfig | null;
  tree: TreeNode[];
  treeLoading: boolean;
  /** 全部文档内容缓存(content/ 路径 -> 正文),预览与构建共用 */
  docsCache: DocsCache;
}

export const useSiteStore = defineStore("site", {
  state: (): State => ({
    open: false,
    root: "",
    config: null,
    tree: [],
    treeLoading: false,
    docsCache: {},
  }),

  getters: {
    docCount(state): number {
      const count = (nodes: TreeNode[]): number =>
        nodes.reduce(
          (n, node) => n + (node.type === "file" && /\.md$/i.test(node.name) ? 1 : 0) + (node.children ? count(node.children) : 0),
          0,
        );
      return count(state.tree);
    },
  },

  actions: {
    async create(dir: string, name: string, description?: string) {
      this.config = await ipc.createSite(dir, name, description);
      this.root = dir;
      this.open = true;
      await this.afterOpen();
    },

    async openDir(dir: string) {
      this.config = await ipc.openSite(dir);
      this.root = dir;
      this.open = true;
      await this.afterOpen();
    },

    async afterOpen() {
      const editor = useEditorStore();
      const theme = useThemeStore();
      const publish = usePublishStore();
      editor.reset();
      useBuilderStore().reset();
      publish.reset();
      await Promise.all([this.refreshTree(), theme.loadAll(), publish.load()]);
      // 默认打开首页
      const index = this.findDoc("index.md");
      if (index) await editor.openDoc(index);
      useAppStore().setView("editor");
    },

    findDoc(path: string): TreeNode | null {
      const walk = (nodes: TreeNode[]): TreeNode | null => {
        for (const n of nodes) {
          if (n.type === "file" && n.path.toLowerCase() === path.toLowerCase()) return n;
          const hit = n.children ? walk(n.children) : null;
          if (hit) return hit;
        }
        return null;
      };
      return walk(this.tree);
    },

    async close() {
      const editor = useEditorStore();
      if (editor.dirty) await editor.save();
      await ipc.closeSite();
      this.$reset();
      useEditorStore().reset();
      useBuilderStore().reset();
      useThemeStore().reset();
      usePublishStore().reset();
      await useAppStore().refreshRecent();
    },

    async refreshTree() {
      this.treeLoading = true;
      try {
        this.tree = await ipc.listTree();
        await this.loadDocs();
      } finally {
        this.treeLoading = false;
      }
    },

    async loadDocs() {
      const paths = collectDocPaths(this.tree);
      if (!paths.length) {
        this.docsCache = {};
        return;
      }
      const contents = await ipc.readDocs(paths);
      const cache: DocsCache = {};
      paths.forEach((p, i) => (cache[p] = contents[i] ?? ""));
      this.docsCache = cache;
    },

    updateDocCache(path: string, content: string) {
      this.docsCache = { ...this.docsCache, [path]: content };
    },

    async saveConfig(patch: Partial<SiteConfig>) {
      this.config = await ipc.saveSiteConfig(patch);
    },

    async setLogo(srcPath: string) {
      const stored = await ipc.setSiteLogo(srcPath);
      this.config = await ipc.saveSiteConfig({ logo: stored });
    },

    async removeLogo() {
      this.config = await ipc.removeSiteLogo();
    },

    /* ---------- 内容操作 ---------- */

    async createDoc(dir: string, name: string, title?: string) {
      const path = await ipc.createDoc(dir, name, title);
      await this.refreshTree();
      await useEditorStore().openDoc(this.findDoc(path) ?? { name, path, type: "file" });
    },

    async createFolder(parent: string, name: string) {
      await ipc.createFolder(parent, name);
      await this.refreshTree();
    },

    async renameItem(path: string, newName: string) {
      const newPath = await ipc.renameItem(path, newName);
      await this.refreshTree();
      const editor = useEditorStore();
      if (editor.activePath === path) {
        editor.activePath = newPath;
      }
      return newPath;
    },

    async moveItem(src: string, destDir: string) {
      const newPath = await ipc.moveItem(src, destDir);
      await this.refreshTree();
      const editor = useEditorStore();
      if (editor.activePath === src) {
        editor.activePath = newPath;
      }
      return newPath;
    },

    async deleteItem(path: string) {
      await ipc.deleteItem(path);
      const editor = useEditorStore();
      if (editor.activePath === path) editor.reset();
      await this.refreshTree();
    },

    async importFiles(srcPaths: string[], destDir: string) {
      const n = await ipc.importFiles(srcPaths, destDir);
      await this.refreshTree();
      return n;
    },
  },
});
