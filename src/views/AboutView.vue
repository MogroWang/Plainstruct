<script setup lang="ts">
/** 关于页 -- 品牌、版本、简介与技术栈,站点打开与否均可访问 */
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/app";
import AppIcon from "@/components/AppIcon.vue";

const { t } = useI18n();
const app = useAppStore();

const featureKeys = [
  "about.featureContent",
  "about.featureBuild",
  "about.featureTheme",
  "about.featurePublish",
] as const;

function goBack() {
  app.setView("editor");
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-bg">
    <div class="mx-auto flex min-h-full w-full max-w-[520px] flex-col items-center justify-center px-6 py-16">
      <img src="/logo-full.svg" alt="Plainstruct" class="h-12 select-none" draggable="false" />

      <div class="mt-8 flex items-baseline gap-3">
        <h1 class="text-[22px] font-bold tracking-tight">素构 Plainstruct</h1>
        <span class="rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-2 mono">
          v{{ app.version }}
        </span>
      </div>
      <p class="mt-3 text-center text-[14px] leading-relaxed text-ink-2">{{ t("app.tagline") }}</p>

      <div class="mt-10 w-full rounded-xl border border-line bg-surface p-6">
        <p class="text-[13.5px] leading-relaxed text-ink-2">{{ t("about.description") }}</p>

        <h2 class="field-label mt-6 mb-3 !text-[12px]">{{ t("about.features") }}</h2>
        <ul class="flex flex-col gap-2">
          <li v-for="key in featureKeys" :key="key" class="flex items-start gap-2 text-[13px] text-ink-2">
            <AppIcon name="check" :size="13" class="mt-[3px] shrink-0 text-ink-3" />
            <span>{{ t(key) }}</span>
          </li>
        </ul>

        <div class="mt-6 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-5 text-[12.5px] text-ink-3">
          <span>Vue 3 · TypeScript · Tauri 2</span>
          <span>© 2026 MogroWang Studio</span>
        </div>
      </div>

      <button class="btn btn-secondary mt-10 h-10 px-6" @click="goBack">
        <AppIcon name="arrowLeft" :size="16" />
        {{ t("common.back") }}
      </button>
    </div>
  </div>
</template>
