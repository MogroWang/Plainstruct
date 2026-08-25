import { defineStore } from "pinia";
import { ipc } from "@/ipc/ipc";
import type { AppSettings, Bootstrap, Locale, Platform, RecentSite } from "@/ipc/types";
import { i18n, type Locale as I18nLocale } from "@/i18n";

export type AppView = "editor" | "site" | "build" | "theme" | "publish" | "about";

interface State {
  ready: boolean;
  bootstrap: Bootstrap | null;
  view: AppView;
}

export const useAppStore = defineStore("app", {
  state: (): State => ({
    ready: false,
    bootstrap: null,
    view: "editor",
  }),

  getters: {
    platform(): Platform {
      return this.bootstrap?.platform ?? "browser";
    },
    settings(): AppSettings {
      return this.bootstrap?.settings ?? { locale: "zh-CN", autosave: true };
    },
    recentSites(): RecentSite[] {
      return this.bootstrap?.recentSites ?? [];
    },
    version(): string {
      return this.bootstrap?.version ?? "";
    },
  },

  actions: {
    async init() {
      this.bootstrap = await ipc.getBootstrap();
      i18n.global.locale.value = this.settings.locale as I18nLocale;
      this.ready = true;
    },

    async setLocale(locale: Locale) {
      this.bootstrap = {
        ...this.bootstrap!,
        settings: { ...this.settings, locale },
      };
      i18n.global.locale.value = locale as I18nLocale;
      await ipc.saveSettings({ locale });
    },

    async setAutosave(enabled: boolean) {
      this.bootstrap = {
        ...this.bootstrap!,
        settings: { ...this.settings, autosave: enabled },
      };
      await ipc.saveSettings({ autosave: enabled });
    },

    setView(view: AppView) {
      this.view = view;
    },

    async refreshRecent() {
      const boot = await ipc.getBootstrap();
      this.bootstrap = { ...this.bootstrap!, recentSites: boot.recentSites };
    },
  },
});
