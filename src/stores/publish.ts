import { defineStore } from "pinia";
import { ipc } from "@/ipc/ipc";
import type { GithubConfig, SyncProgress, SyncResult, VerifyResult } from "@/ipc/types";
import { useBuilderStore } from "./builder";
import { useUiStore } from "./ui";

interface State {
  config: GithubConfig;
  loaded: boolean;
  verifying: boolean;
  verifyResult: VerifyResult | null;
  syncing: boolean;
  progress: SyncProgress | null;
  result: SyncResult | null;
  error: string | null;
}

export const usePublishStore = defineStore("publish", {
  state: (): State => ({
    config: { owner: "", repo: "", branch: "gh-pages", token: "", autoCreate: true },
    loaded: false,
    verifying: false,
    verifyResult: null,
    syncing: false,
    progress: null,
    result: null,
    error: null,
  }),

  actions: {
    reset() {
      this.$reset();
    },

    async load() {
      this.config = await ipc.githubReadConfig();
      this.loaded = true;
    },

    async save() {
      await ipc.githubSaveConfig(this.config);
    },

    async verify() {
      this.verifying = true;
      this.verifyResult = null;
      try {
        this.verifyResult = await ipc.githubVerify(this.config);
        await this.save();
      } finally {
        this.verifying = false;
      }
    },

    async sync() {
      const builder = useBuilderStore();
      const ui = useUiStore();
      if (!builder.report) {
        ui.toast("请先构建站点", "error");
        return;
      }
      this.syncing = true;
      this.progress = null;
      this.result = null;
      this.error = null;
      try {
        await this.save();
        this.result = await ipc.githubSync(this.config, (p) => {
          this.progress = p;
        });
      } catch (e) {
        this.error = ipc.errText(e);
      } finally {
        this.syncing = false;
      }
    },
  },
});
