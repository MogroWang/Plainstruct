<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/app";
import { ipc } from "@/ipc/ipc";
import type { Locale } from "@/ipc/types";
import AppIcon from "@/components/AppIcon.vue";

const { t } = useI18n();
const app = useAppStore();

const localeOptions: { value: Locale; label: string }[] = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en-US", label: "English" },
];

async function onLocaleChange(locale: Locale) {
  await app.setLocale(locale);
}

async function onAutosaveToggle() {
  await app.setAutosave(!app.settings.autosave);
}

/* ---------- 检查更新(以 GitHub 最新 Release 为准) ---------- */

type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "latest" }
  | { kind: "available"; version: string; url: string }
  | { kind: "error"; message: string };

const update = ref<UpdateState>({ kind: "idle" });

const updateHint = computed(() => {
  switch (update.value.kind) {
    case "checking":
      return t("settings.checking");
    case "latest":
      return t("settings.upToDate");
    case "available":
      return t("settings.updateAvailable", { v: update.value.version });
    case "error":
      return t("settings.checkFailed", { msg: update.value.message });
    default:
      return t("settings.checkUpdateHint");
  }
});

async function checkUpdate() {
  update.value = { kind: "checking" };
  try {
    const info = await ipc.checkUpdate();
    update.value = info.hasUpdate
      ? { kind: "available", version: info.latestVersion, url: info.releaseUrl }
      : { kind: "latest" };
  } catch (e) {
    update.value = { kind: "error", message: ipc.errText(e) };
  }
}

function openRelease(url: string) {
  if (url) void ipc.openExternal(url);
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-b border-line px-6 py-5">
      <div class="flex items-center gap-3">
        <button class="btn-icon" :title="t('common.back')" @click="app.setView('editor')">
          <AppIcon name="arrowLeft" :size="18" />
        </button>
        <div>
          <h2 class="text-[18px] font-semibold tracking-tight">{{ t("settings.title") }}</h2>
          <p class="mt-1 text-[13px] text-ink-3">{{ t("settings.subtitle") }}</p>
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <!-- 语言 -->
      <section class="mb-8">
        <h3 class="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-3">
          {{ t("settings.sectionLanguage") }}
        </h3>
        <div class="rounded-lg border border-line bg-surface p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[14px] font-medium">{{ t("settings.language") }}</p>
              <p class="mt-0.5 text-[12.5px] text-ink-3">{{ t("settings.languageHint") }}</p>
            </div>
            <select
              class="h-9 rounded-md border border-line bg-bg px-3 text-[13px] text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              :value="app.settings.locale"
              @change="onLocaleChange(($event.target as HTMLSelectElement).value as Locale)"
            >
              <option v-for="opt in localeOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>
      </section>

      <!-- 编辑器 -->
      <section class="mb-8">
        <h3 class="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-3">
          {{ t("settings.sectionEditor") }}
        </h3>
        <div class="rounded-lg border border-line bg-surface p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[14px] font-medium">{{ t("settings.autosave") }}</p>
              <p class="mt-0.5 text-[12.5px] text-ink-3">{{ t("settings.autosaveHint") }}</p>
            </div>
            <button
              class="relative inline-flex h-6 w-10 items-center rounded-full transition-colors"
              :class="app.settings.autosave ? 'bg-accent' : 'bg-line-strong'"
              role="switch"
              :aria-checked="app.settings.autosave"
              @click="onAutosaveToggle"
            >
              <span
                class="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                :class="app.settings.autosave ? 'translate-x-[22px]' : 'translate-x-[4px]'"
              />
            </button>
          </div>
        </div>
      </section>

      <!-- 关于 -->
      <section>
        <h3 class="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-3">
          {{ t("settings.sectionAbout") }}
        </h3>
        <div class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[14px] font-medium">{{ t("settings.version") }}</p>
              <p class="mt-0.5 text-[12.5px] text-ink-3">{{ app.version }}</p>
            </div>
            <button
              class="btn btn-secondary flex items-center gap-1.5 text-[13px]"
              @click="app.setView('about')"
            >
              <AppIcon name="info" :size="14" />
              {{ t("nav.about") }}
            </button>
          </div>

          <!-- 检查更新 -->
          <div class="flex items-center justify-between border-t border-line pt-4">
            <div class="min-w-0 pr-4">
              <p class="text-[14px] font-medium">{{ t("settings.checkUpdate") }}</p>
              <p
                class="mt-0.5 truncate text-[12.5px]"
                :class="update.kind === 'available' ? 'text-accent' : update.kind === 'error' ? 'text-danger' : 'text-ink-3'"
              >
                {{ updateHint }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button
                v-if="update.kind === 'available'"
                class="btn btn-primary flex items-center gap-1.5 text-[13px]"
                @click="openRelease(update.url)"
              >
                <AppIcon name="external" :size="14" />
                {{ t("settings.viewRelease") }}
              </button>
              <button
                class="btn btn-secondary flex items-center gap-1.5 text-[13px]"
                :disabled="update.kind === 'checking'"
                @click="checkUpdate"
              >
                <AppIcon name="refresh" :size="14" :class="{ 'animate-spin': update.kind === 'checking' }" />
                {{
                  update.kind === "checking"
                    ? t("settings.checking")
                    : update.kind === "latest"
                      ? t("settings.checkAgain")
                      : t("settings.checkUpdate")
                }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>