import { defineStore } from "pinia";
import { ipc } from "@/ipc/ipc";
import type { TreeNode } from "@/ipc/types";
import { extractHeadings, type Heading } from "@/lib/markdown";
import { parseFrontMatter } from "@/lib/frontmatter";
import { stripExt } from "@/lib/paths";
import { useAppStore } from "./app";
import { useBuilderStore } from "./builder";
import { useSiteStore } from "./site";

export type EditorMode = "edit" | "split" | "preview";

interface State {
  activePath: string | null;
  content: string;
  savedContent: string;
  saving: boolean;
  mode: EditorMode;
  headings: Heading[];
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useEditorStore = defineStore("editor", {
  state: (): State => ({
    activePath: null,
    content: "",
    savedContent: "",
    saving: false,
    mode: "split",
    headings: [],
  }),

  getters: {
    dirty(state): boolean {
      return state.activePath !== null && state.content !== state.savedContent;
    },
    docTitle(state): string {
      if (!state.activePath) return "";
      const { data } = parseFrontMatter(state.content);
      return data.title ?? stripExt(state.activePath.split("/").pop() ?? "");
    },
  },

  actions: {
    reset() {
      if (autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = null;
      this.$reset();
    },

    async openDoc(node: TreeNode) {
      const app = useAppStore();
      if (app.view !== "editor") app.setView("editor");
      if (this.dirty) await this.save();
      const [text] = await ipc.readDocs([node.path]);
      this.activePath = node.path;
      this.content = text ?? "";
      this.savedContent = text ?? "";
      this.headings = extractHeadings(this.content);
    },

    /** 编辑器内容变更(来自 CodeMirror) */
    onInput(text: string) {
      this.content = text;
      this.headings = extractHeadings(text);
      if (!useAppStore().settings.autosave) return;
      if (autosaveTimer) clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => {
        void this.save();
      }, 900);
    },

    async save() {
      if (!this.activePath || this.content === this.savedContent || this.saving) return;
      this.saving = true;
      try {
        await ipc.saveDoc(this.activePath, this.content);
        this.savedContent = this.content;
        useSiteStore().updateDocCache(this.activePath, this.content);
        useBuilderStore().onDocSaved();
      } finally {
        this.saving = false;
      }
    },

    setMode(mode: EditorMode) {
      this.mode = mode;
    },
  },
});
