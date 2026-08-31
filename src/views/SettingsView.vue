<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/app";
import { ipc } from "@/ipc/ipc";
import type { AppTheme, EditorFontMode, Locale, UiFontMode } from "@/ipc/types";
import AppIcon from "@/components/AppIcon.vue";
import SelectMenu from "@/components/SelectMenu.vue";

const { t } = useI18n();
const app = useAppStore();

const localeOptions: { value: Locale; label: string }[] = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en-US", label: "English" },
];

const localeModel = computed({
  get: () => app.settings.locale,
  set: (v: Locale) => void app.setLocale(v),
});

async function onAutosaveToggle() {
  await app.setAutosave(!app.settings.autosave);
}

/* ---------- 个性化(主题与字体) ---------- */

const themeOptions = computed<{ value: AppTheme; label: string }[]>(() => [
  { value: "system", label: t("settings.themeSystem") },
  { value: "light", label: t("settings.themeLight") },
  { value: "dark", label: t("settings.themeDark") },
]);

const uiFontOptions = computed<{ value: UiFontMode; label: string }[]>(() => [
  { value: "system", label: t("settings.fontSystem") },
  { value: "serif", label: t("settings.fontSerif") },
  { value: "mono", label: t("settings.fontMono") },
  { value: "custom", label: t("settings.fontCustom") },
]);

const editorFontOptions = computed<{ value: EditorFontMode; label: string }[]>(() => [
  { value: "default", label: t("settings.fontEditorDefault") },
  { value: "ui", label: t("settings.fontUi") },
  { value: "serif", label: t("settings.fontSerif") },
  { value: "custom", label: t("settings.fontCustom") },
]);

const themeModel = computed({
  get: () => app.settings.theme ?? "system",
  set: (v: AppTheme) => void app.setAppearance({ theme: v }),
});
const uiFontModel = computed({
  get: () => app.settings.uiFont ?? "system",
  set: (v: UiFontMode) => void app.setAppearance({ uiFont: v }),
});
const editorFontModel = computed({
  get: () => app.settings.editorFont ?? "default",
  set: (v: EditorFontMode) => void app.setAppearance({ editorFont: v }),
});

function onUiFontCustom(e: Event) {
  void app.setAppearance({ uiFontCustom: (e.target as HTMLInputElement).value });
}
function onEditorFontCustom(e: Event) {
  void app.setAppearance({ editorFontCustom: (e.target as HTMLInputElement).value });
}

/* ---------- 类别分页:一次只显示一个类别,按导航次序决定滑入方向 ---------- */

const sections = computed(() => [
  { id: "language", label: t("settings.sectionLanguage") },
  { id: "editor", label: t("settings.sectionEditor") },
  { id: "personalization", label: t("settings.sectionPersonalization") },
  { id: "about", label: t("settings.sectionAbout") },
]);

const active = ref("language");
/** 切换方向:向下切换 = 新页自下方滑入,向上切换反之 */
const direction = ref<"up" | "down">("down");

function goTo(id: string) {
  if (id === active.value) return;
  const from = sections.value.findIndex((s) => s.id === active.value);
  const to = sections.value.findIndex((s) => s.id === id);
  direction.value = to > from ? "down" : "up";
  active.value = id;
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
  <div class="flex h-full">
    <!-- 左侧:类别导航(点击切换,右侧仅显示当前类别) -->
    <aside class="flex w-[208px] shrink-0 flex-col border-r border-line bg-surface">
      <div class="flex items-center gap-2 px-3 pb-2 pt-4">
        <button class="btn-icon" :title="t('common.back')" @click="app.setView('editor')">
          <AppIcon name="arrowLeft" :size="17" />
        </button>
        <h2 class="truncate text-[14.5px] font-semibold tracking-tight">{{ t("settings.title") }}</h2>
      </div>
      <p class="px-4 text-[11.5px] leading-relaxed text-ink-3">{{ t("settings.subtitle") }}</p>

      <nav class="mt-5 flex flex-col gap-0.5 px-2">
        <button
          v-for="s in sections"
          :key="s.id"
          class="settings-nav-item"
          :class="{ active: active === s.id }"
          @click="goTo(s.id)"
        >
          {{ s.label }}
        </button>
      </nav>

      <div class="mt-auto px-4 pb-4 text-[11px] text-ink-3 mono">v{{ app.version }}</div>
    </aside>

    <!-- 右侧:当前类别页(切换时整体按方向滑动淡入,行内设置次第浮现) -->
    <div class="relative min-h-0 flex-1 overflow-hidden">
      <Transition name="settings-page" mode="out-in">
        <div :key="active" class="absolute inset-0 overflow-y-auto" :data-dir="direction">
          <div class="mx-auto w-full max-w-[640px] px-8 pb-10 pt-8">
            <!-- 语言 -->
            <template v-if="active === 'language'">
              <h3 class="settings-heading" style="--i: 0">
                {{ t("settings.sectionLanguage") }}
              </h3>
              <div class="settings-card">
                <div class="settings-row" style="--i: 0">
                  <div class="min-w-0">
                    <p class="text-[13.5px] font-medium">{{ t("settings.language") }}</p>
                    <p class="mt-0.5 text-[12px] leading-relaxed text-ink-3">{{ t("settings.languageHint") }}</p>
                  </div>
                  <SelectMenu v-model="localeModel" :options="localeOptions" align="right" class="shrink-0" />
                </div>
              </div>
            </template>

            <!-- 编辑器 -->
            <template v-else-if="active === 'editor'">
              <h3 class="settings-heading" style="--i: 0">
                {{ t("settings.sectionEditor") }}
              </h3>
              <div class="settings-card">
                <div class="settings-row" style="--i: 0">
                  <div class="min-w-0">
                    <p class="text-[13.5px] font-medium">{{ t("settings.autosave") }}</p>
                    <p class="mt-0.5 text-[12px] leading-relaxed text-ink-3">{{ t("settings.autosaveHint") }}</p>
                  </div>
                  <button
                    class="relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors"
                    :class="app.settings.autosave ? 'bg-accent' : 'bg-line-strong'"
                    role="switch"
                    :aria-checked="app.settings.autosave"
                    @click="onAutosaveToggle"
                  >
                    <span
                      class="inline-block h-4 w-4 rounded-full bg-surface shadow-sm transition-transform"
                      :class="app.settings.autosave ? 'translate-x-[22px]' : 'translate-x-[4px]'"
                    />
                  </button>
                </div>
              </div>
            </template>

            <!-- 个性化 -->
            <template v-else-if="active === 'personalization'">
              <h3 class="settings-heading" style="--i: 0">
                {{ t("settings.sectionPersonalization") }}
              </h3>
              <div class="settings-card">
                <!-- 软件主题 -->
                <div class="settings-row" style="--i: 0">
                  <div class="min-w-0">
                    <p class="text-[13.5px] font-medium">{{ t("settings.theme") }}</p>
                    <p class="mt-0.5 text-[12px] leading-relaxed text-ink-3">{{ t("settings.themeHint") }}</p>
                  </div>
                  <SelectMenu v-model="themeModel" :options="themeOptions" align="right" class="shrink-0" />
                </div>

                <!-- 界面字体 -->
                <div class="settings-row" style="--i: 1">
                  <div class="min-w-0">
                    <p class="text-[13.5px] font-medium">{{ t("settings.uiFont") }}</p>
                    <p class="mt-0.5 text-[12px] leading-relaxed text-ink-3">{{ t("settings.uiFontHint") }}</p>
                    <div v-if="uiFontModel === 'custom'" class="mt-2.5">
                      <input
                        class="input h-8 w-full max-w-[320px] text-[12.5px]"
                        type="text"
                        spellcheck="false"
                        :placeholder="t('settings.fontCustomPlaceholder')"
                        :value="app.settings.uiFontCustom ?? ''"
                        @change="onUiFontCustom"
                      />
                      <p class="mt-1 text-[11px] leading-relaxed text-ink-3">{{ t("settings.fontCustomHint") }}</p>
                    </div>
                  </div>
                  <SelectMenu v-model="uiFontModel" :options="uiFontOptions" align="right" class="shrink-0" />
                </div>

                <!-- 编辑器字体 -->
                <div class="settings-row" style="--i: 2">
                  <div class="min-w-0">
                    <p class="text-[13.5px] font-medium">{{ t("settings.editorFont") }}</p>
                    <p class="mt-0.5 text-[12px] leading-relaxed text-ink-3">{{ t("settings.editorFontHint") }}</p>
                    <div v-if="editorFontModel === 'custom'" class="mt-2.5">
                      <input
                        class="input h-8 w-full max-w-[320px] text-[12.5px]"
                        type="text"
                        spellcheck="false"
                        :placeholder="t('settings.fontCustomPlaceholder')"
                        :value="app.settings.editorFontCustom ?? ''"
                        @change="onEditorFontCustom"
                      />
                      <p class="mt-1 text-[11px] leading-relaxed text-ink-3">{{ t("settings.fontCustomHint") }}</p>
                    </div>
                  </div>
                  <SelectMenu v-model="editorFontModel" :options="editorFontOptions" align="right" class="shrink-0" />
                </div>
              </div>
            </template>

            <!-- 关于 -->
            <template v-else>
              <h3 class="settings-heading" style="--i: 0">
                {{ t("settings.sectionAbout") }}
              </h3>
              <div class="settings-card">
                <div class="settings-row" style="--i: 0">
                  <div class="min-w-0">
                    <p class="text-[13.5px] font-medium">{{ t("settings.version") }}</p>
                    <p class="mt-0.5 text-[12px] leading-relaxed text-ink-3">{{ app.version }}</p>
                  </div>
                  <button class="btn btn-secondary shrink-0" @click="app.setView('about')">
                    <AppIcon name="info" :size="14" />
                    {{ t("nav.about") }}
                  </button>
                </div>

                <!-- 检查更新 -->
                <div class="settings-row" style="--i: 1">
                  <div class="min-w-0">
                    <p class="text-[13.5px] font-medium">{{ t("settings.checkUpdate") }}</p>
                    <p
                      class="mt-0.5 truncate text-[12px] leading-relaxed"
                      :class="update.kind === 'available' ? 'text-accent' : update.kind === 'error' ? 'text-danger' : 'text-ink-3'"
                    >
                      {{ updateHint }}
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <button
                      v-if="update.kind === 'available'"
                      class="btn btn-primary"
                      @click="openRelease(update.url)"
                    >
                      <AppIcon name="external" :size="14" />
                      {{ t("settings.viewRelease") }}
                    </button>
                    <button class="btn btn-secondary" :disabled="update.kind === 'checking'" @click="checkUpdate">
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
            </template>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* 分区导航项:悬停浅底,当前项实底 */
.settings-nav-item {
  position: relative;
  display: block;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--color-ink-2);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-plain),
    color var(--duration-fast) var(--ease-plain);
}
.settings-nav-item:hover {
  background: var(--color-surface-2);
  color: var(--color-ink);
}
.settings-nav-item.active {
  background: var(--color-surface-3);
  color: var(--color-ink);
  font-weight: 500;
}

/* 类别页切换:进出同路径、镜像缓动,方向随导航次序变化 */
.settings-page-enter-active {
  transition:
    opacity var(--duration-slow) var(--ease-plain),
    transform var(--duration-slow) var(--ease-plain);
}
.settings-page-leave-active {
  transition:
    opacity var(--duration-base) var(--ease-plain-inverse),
    transform var(--duration-base) var(--ease-plain-inverse);
}
.settings-page-enter-from,
.settings-page-leave-to {
  opacity: 0;
}
.settings-page-enter-from[data-dir="down"],
.settings-page-leave-to[data-dir="up"] {
  transform: translateY(16px);
}
.settings-page-enter-from[data-dir="up"],
.settings-page-leave-to[data-dir="down"] {
  transform: translateY(-16px);
}

/* 页内元素次第浮现:标题先行,设置行按序跟进 */
.settings-page-enter-active .settings-heading {
  transition:
    opacity var(--duration-slow) var(--ease-plain),
    transform var(--duration-slow) var(--ease-plain);
}
.settings-page-enter-from .settings-heading {
  opacity: 0;
  transform: translateY(6px);
}
.settings-page-enter-active .settings-card {
  transition: opacity var(--duration-base) var(--ease-plain);
}
.settings-page-enter-from .settings-card {
  opacity: 0;
}
.settings-page-enter-active .settings-row {
  transition:
    opacity var(--duration-slow) var(--ease-plain),
    transform var(--duration-slow) var(--ease-plain);
  transition-delay: calc(60ms + var(--i, 0) * 45ms);
}
.settings-page-enter-from .settings-row {
  opacity: 0;
  transform: translateY(8px);
}

/* 类别标题与设置卡片 */
.settings-heading {
  margin-bottom: 10px;
  font-size: 12.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-ink-3);
}
.settings-card {
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--color-surface);
  padding: 0 16px;
}
.settings-card + .settings-card {
  margin-top: 12px;
}

/* 设置行:标签与控件左右分布,行间细分隔线 */
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 0;
}
.settings-row:first-child {
  padding-top: 15px;
}
.settings-row:last-child {
  padding-bottom: 15px;
}
.settings-row + .settings-row {
  border-top: 1px solid var(--color-line);
}
</style>
