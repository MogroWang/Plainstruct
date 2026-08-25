<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/app";
import { useSiteStore } from "@/stores/site";
import AppIcon from "./AppIcon.vue";

const { t } = useI18n();
const app = useAppStore();
const site = useSiteStore();

const maximized = ref(false);

const showWindowControls = computed(() => app.platform === "windows" || app.platform === "macos");
const onMac = computed(() => app.platform === "macos");

async function winAction(action: "minimize" | "toggleMaximize" | "close") {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  if (action === "minimize") await win.minimize();
  else if (action === "toggleMaximize") {
    await win.toggleMaximize();
    maximized.value = await win.isMaximized();
  } else await win.close();
}

async function toggleLocale() {
  const next = app.settings.locale === "zh-CN" ? "en-US" : "zh-CN";
  await app.setLocale(next);
}
</script>

<template>
  <header
    class="titlebar flex h-10 shrink-0 select-none items-center gap-2 border-b border-line bg-surface pl-3 pr-2"
    data-tauri-drag-region
    @dblclick="showWindowControls && winAction('toggleMaximize')"
  >
    <!-- macOS 红绿灯占位 -->
    <div v-if="onMac" class="flex items-center gap-2 pl-1">
      <button class="btn-icon !h-3 !w-3 !rounded-full" style="background:#e5e3e1" :title="t('titlebar.close')" @click="winAction('close')" />
      <button class="btn-icon !h-3 !w-3 !rounded-full" style="background:#e5e3e1" :title="t('titlebar.minimize')" @click="winAction('minimize')" />
      <button class="btn-icon !h-3 !w-3 !rounded-full" style="background:#e5e3e1" :title="t('titlebar.maximize')" @click="winAction('toggleMaximize')" />
    </div>

    <div class="flex items-center gap-2" data-tauri-drag-region>
      <img src="/logo.svg" alt="" class="h-5 w-5" draggable="false" />
      <span class="text-[13px] font-semibold tracking-tight">{{ t("app.name") }}</span>
      <span v-if="site.open && site.config" class="text-[13px] text-ink-3">/</span>
      <span v-if="site.open && site.config" class="text-[13px] text-ink-2">{{ site.config.name }}</span>
    </div>

    <div class="ml-auto flex items-center gap-1">
      <button
        class="btn-icon"
        :title="t('titlebar.language')"
        @click="toggleLocale"
      >
        <AppIcon name="globe" :size="16" />
      </button>

      <template v-if="showWindowControls && !onMac">
        <button class="btn-icon" :title="t('titlebar.minimize')" @click="winAction('minimize')">
          <AppIcon name="minus" :size="14" />
        </button>
        <button class="btn-icon" :title="maximized ? t('titlebar.restore') : t('titlebar.maximize')" @click="winAction('toggleMaximize')">
          <AppIcon :name="maximized ? 'restore' : 'maximize'" :size="13" />
        </button>
        <button
          class="btn-icon hover:!bg-danger hover:!text-white"
          :title="t('titlebar.close')"
          @click="winAction('close')"
        >
          <AppIcon name="x" :size="14" />
        </button>
      </template>
    </div>
  </header>
</template>

<style scoped>
.titlebar button {
  -webkit-app-region: no-drag;
}
</style>
