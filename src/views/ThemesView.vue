<script setup lang="ts">
/** 主题页:列表 + 配置面板 + 主题制作器(代码编辑 + 实时预览 + ZIP 导入导出) */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useSiteStore } from "@/stores/site";
import { useThemeStore } from "@/stores/theme";
import { useUiStore } from "@/stores/ui";
import { ipc } from "@/ipc/ipc";
import type { ThemeMeta } from "@/ipc/types";
import AppIcon from "@/components/AppIcon.vue";
import ThemeConfigPanel from "@/components/ThemeConfigPanel.vue";
import ThemePreview from "@/components/ThemePreview.vue";
import CodeEditor from "@/components/CodeEditor.vue";
import PromptModal from "@/components/PromptModal.vue";

const { t } = useI18n();
const site = useSiteStore();
const theme = useThemeStore();
const ui = useUiStore();

const tab = ref<"config" | "maker">("config");

function isActive(meta: ThemeMeta): boolean {
  return site.config?.theme.id === meta.id && sourceOf(meta) === site.config?.theme.source;
}
function sourceOf(meta: ThemeMeta): "builtin" | "custom" {
  return meta.source;
}

async function activate(meta: ThemeMeta) {
  await theme.selectTheme(meta.id, sourceOf(meta));
  tab.value = "config";
}

async function edit(meta: ThemeMeta) {
  try {
    if (meta.source === "builtin") {
      // 内置主题不可改,先复制为自定义
      const name = await askName(t("theme.newFrom"), meta.name);
      if (!name) return;
      const created = await theme.createFrom("builtin", meta.id, name);
      await theme.startEditing(created.id, "custom");
    } else {
      await theme.startEditing(meta.id, "custom");
    }
    tab.value = "maker";
  } catch (e) {
    ui.toast(t("ui.operationFailed", { msg: ipc.errText(e) }), "error");
  }
}

async function exportTheme(meta: ThemeMeta) {
  const dest = await ipc.pickZipDest(`${meta.id}.zip`);
  if (!dest) return;
  try {
    if (meta.source === "custom") {
      const files = await ipc.readThemeFiles(meta.id);
      await ipc.exportThemeZip(files, dest);
    } else {
      await theme.exportBuiltin(meta.id, dest);
    }
    ui.toast(t("theme.exportDone"), "success");
  } catch (e) {
    ui.toast(t("ui.operationFailed", { msg: ipc.errText(e) }), "error");
  }
}

async function removeTheme(meta: ThemeMeta) {
  const ok = await ui.confirmDialog({
    title: t("theme.deleteTheme"),
    body: t("theme.deleteThemeBody", { name: meta.name }),
    danger: true,
    confirmText: t("common.delete"),
  });
  if (!ok) return;
  await theme.deleteCustom(meta.id);
  if (theme.editing?.id === meta.id) theme.editing = null;
}

async function importZip() {
  const zipPath = await ipc.pickThemeZip();
  if (!zipPath) return;
  try {
    const meta = await theme.importZip(zipPath);
    await theme.startEditing(meta.id, "custom");
    tab.value = "maker";
  } catch (e) {
    ui.toast(t("theme.importFailed", { msg: ipc.errText(e) }), "error");
  }
}

/* ---------- 名称询问 ---------- */

const askOpen = ref(false);
const askTitle = ref("");
const askHint = ref("");
let askResolve: ((v: string | null) => void) | null = null;

function askName(title: string, hint: string): Promise<string | null> {
  askTitle.value = title;
  askHint.value = hint;
  askOpen.value = true;
  return new Promise((resolve) => {
    askResolve = resolve;
  });
}

function onAskConfirm(v: string) {
  askOpen.value = false;
  askResolve?.(v.trim() || null);
  askResolve = null;
}

function onAskCancel() {
  askOpen.value = false;
  askResolve?.(null);
  askResolve = null;
}

async function duplicateBuiltin() {
  const base = theme.builtinMetas[0];
  const name = await askName(t("theme.newFromBuiltin"), base?.name ?? "");
  if (!name || !base) return;
  try {
    const created = await theme.createFrom("builtin", base.id, name);
    await theme.startEditing(created.id, "custom");
    tab.value = "maker";
  } catch (e) {
    ui.toast(t("ui.operationFailed", { msg: ipc.errText(e) }), "error");
  }
}

/* ---------- 制作器 ---------- */

const editingFiles = computed(() =>
  theme.editing ? Object.keys(theme.editing.files).sort() : [],
);

const activeFileContent = computed({
  get: () => theme.editing?.files[theme.editingActiveFile] ?? "",
  set: (v: string) => theme.setEditingFile(theme.editingActiveFile, v),
});

function langOf(path: string): "html" | "css" | "json" | "markdown" {
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css")) return "css";
  return "html";
}

const makerDirty = ref(false);
watch(activeFileContent, () => (makerDirty.value = true));

async function saveMaker() {
  if (!theme.editing) return;
  try {
    JSON.parse(theme.editing.files["theme.json"] ?? "{}");
  } catch {
    ui.toast(t("theme.invalidJson"), "error");
    return;
  }
  try {
    await theme.saveEditing();
    makerDirty.value = false;
    ui.toast(t("theme.filesSaved"), "success");
  } catch (e) {
    ui.toast(t("ui.saveFailed", { msg: ipc.errText(e) }), "error");
  }
}

async function exportMaker() {
  if (!theme.editing) return;
  const dest = await ipc.pickZipDest(`${theme.editing.id}.zip`);
  if (!dest) return;
  try {
    await theme.exportEditing(dest);
    ui.toast(t("theme.exportDone"), "success");
  } catch (e) {
    ui.toast(t("ui.operationFailed", { msg: ipc.errText(e) }), "error");
  }
}

/* ---------- 站点当前主题引用的补充(编辑中的主题仍被站点使用时) ---------- */

const activeLabel = computed(() => theme.activeMeta?.name ?? "-");
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-bg">
    <!-- 头部 -->
    <header class="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-5">
      <div class="min-w-0">
        <h1 class="text-[15px] font-semibold leading-tight">{{ t("theme.title") }}</h1>
        <p class="truncate text-[12px] text-ink-3">{{ t("theme.subtitle") }}</p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <button class="btn btn-secondary" @click="importZip">
          <AppIcon name="download" :size="15" />
          {{ t("theme.importZip") }}
        </button>
        <button class="btn btn-secondary" @click="duplicateBuiltin">
          <AppIcon name="copy" :size="15" />
          {{ t("theme.newFromBuiltin") }}
        </button>
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <!-- 主题列表 -->
      <aside class="w-[264px] shrink-0 overflow-y-auto border-r border-line bg-surface">
        <div class="p-3">
          <h2 class="field-label mb-1">{{ t("theme.builtin") }}</h2>
          <div class="flex flex-col gap-1">
            <div
              v-for="meta in theme.builtinMetas"
              :key="meta.id"
              class="theme-item"
              :class="{ current: isActive(meta) }"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-[13px] font-medium">{{ meta.name }}</p>
                <p class="mono truncate text-[11px] text-ink-3">v{{ meta.version }}</p>
              </div>
              <span v-if="isActive(meta)" class="badge">{{ t("theme.active") }}</span>
              <div class="item-actions flex items-center gap-0.5">
                <button v-if="!isActive(meta)" class="btn-icon !h-7 !w-7" :title="t('theme.setActive')" @click="activate(meta)">
                  <AppIcon name="check" :size="14" />
                </button>
                <button class="btn-icon !h-7 !w-7" :title="t('theme.newFrom')" @click="edit(meta)">
                  <AppIcon name="pencil" :size="14" />
                </button>
                <button class="btn-icon !h-7 !w-7" :title="t('theme.exportZip')" @click="exportTheme(meta)">
                  <AppIcon name="download" :size="14" />
                </button>
              </div>
            </div>
          </div>

          <h2 class="field-label mb-1 mt-5">{{ t("theme.custom") }}</h2>
          <p v-if="!theme.customMetas.length" class="rounded-lg border border-dashed border-line px-3 py-4 text-[12px] leading-relaxed text-ink-3">
            {{ t("theme.noCustom") }}
          </p>
          <div v-else class="flex flex-col gap-1">
            <div
              v-for="meta in theme.customMetas"
              :key="meta.id"
              class="theme-item"
              :class="{ current: isActive(meta) }"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-[13px] font-medium">{{ meta.name }}</p>
                <p class="mono truncate text-[11px] text-ink-3">v{{ meta.version }}</p>
              </div>
              <span v-if="isActive(meta)" class="badge">{{ t("theme.active") }}</span>
              <div class="item-actions flex items-center gap-0.5">
                <button v-if="!isActive(meta)" class="btn-icon !h-7 !w-7" :title="t('theme.setActive')" @click="activate(meta)">
                  <AppIcon name="check" :size="14" />
                </button>
                <button class="btn-icon !h-7 !w-7" :title="t('theme.maker')" @click="edit(meta)">
                  <AppIcon name="pencil" :size="14" />
                </button>
                <button class="btn-icon !h-7 !w-7" :title="t('theme.exportZip')" @click="exportTheme(meta)">
                  <AppIcon name="download" :size="14" />
                </button>
                <button class="btn-icon !h-7 !w-7 hover:!text-danger" :title="t('theme.deleteTheme')" @click="removeTheme(meta)">
                  <AppIcon name="trash" :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧:配置 / 制作 -->
      <section class="flex min-w-0 flex-1 flex-col">
        <div class="flex h-10 shrink-0 items-center gap-1 border-b border-line bg-surface px-4">
          <button class="tab-btn" :class="{ active: tab === 'config' }" @click="tab = 'config'">
            {{ t("theme.config") }} · {{ activeLabel }}
          </button>
          <button class="tab-btn" :class="{ active: tab === 'maker' }" :disabled="!theme.editing" @click="tab = 'maker'">
            {{ t("theme.maker") }}
          </button>
        </div>

        <div class="flex min-h-0 flex-1">
          <!-- 左:配置面板或代码编辑 -->
          <div class="flex min-w-0 flex-1 flex-col">
            <template v-if="tab === 'config'">
              <div class="min-h-0 flex-1 overflow-y-auto p-6">
                <p class="field-hint mb-6">{{ t("theme.configHint") }}</p>
                <ThemeConfigPanel />
              </div>
            </template>

            <template v-else-if="theme.editing">
              <!-- 文件标签 -->
              <div class="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-surface px-2">
                <button
                  v-for="file in editingFiles"
                  :key="file"
                  class="file-tab"
                  :class="{ active: theme.editingActiveFile === file }"
                  @click="theme.editingActiveFile = file"
                >
                  {{ file }}
                </button>
              </div>
              <div class="min-h-0 flex-1 bg-surface">
                <CodeEditor v-model="activeFileContent" :language="langOf(theme.editingActiveFile)" />
              </div>
              <div class="flex h-12 shrink-0 items-center gap-2 border-t border-line bg-surface px-4">
                <span class="text-[12px] text-ink-3">{{ theme.editing.name }}</span>
                <div class="ml-auto flex gap-2">
                  <button class="btn btn-secondary" @click="exportMaker">
                    <AppIcon name="download" :size="14" />
                    {{ t("theme.exportZip") }}
                  </button>
                  <button class="btn btn-primary" :disabled="!makerDirty" @click="saveMaker">
                    {{ t("theme.saveFiles") }}
                  </button>
                </div>
              </div>
            </template>

            <div v-else class="flex flex-1 items-center justify-center text-[13px] text-ink-3">
              {{ t("theme.noCustom") }}
            </div>
          </div>

          <!-- 右:实时预览 -->
          <div class="flex w-[46%] min-w-[320px] shrink-0 flex-col border-l border-line">
            <div class="flex h-10 shrink-0 items-center border-b border-line bg-surface px-4">
              <span class="text-[12.5px] font-semibold text-ink-2">{{ t("theme.previewDoc") }}</span>
            </div>
            <div class="min-h-0 flex-1">
              <ThemePreview />
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 命名询问 -->
    <PromptModal
      :open="askOpen"
      :title="askTitle"
      :label="t('theme.newName')"
      :placeholder="askHint"
      :confirm-text="t('common.create')"
      @confirm="onAskConfirm"
      @cancel="onAskCancel"
    />
  </div>
</template>

<style scoped>
.theme-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  transition:
    background-color var(--duration-base) var(--ease-plain),
    border-color var(--duration-base) var(--ease-plain);
}
.theme-item:hover {
  background: var(--color-surface-2);
}
.theme-item.current {
  border-color: var(--color-line);
  background: var(--color-surface-2);
}
.theme-item .item-actions {
  opacity: 0;
  transition: opacity var(--duration-base) var(--ease-plain);
}
.theme-item:hover .item-actions {
  opacity: 1;
}

.badge {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-accent);
  color: #fff;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.tab-btn {
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-ink-2);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color var(--duration-base) var(--ease-plain),
    color var(--duration-base) var(--ease-plain);
}
.tab-btn:hover {
  background: var(--color-surface-2);
}
.tab-btn.active {
  background: var(--color-surface-3);
  color: var(--color-ink);
}
.tab-btn:disabled {
  opacity: 0.4;
  pointer-events: none;
}

.file-tab {
  flex-shrink: 0;
  height: 26px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-ink-2);
  font-size: 11.5px;
  cursor: pointer;
  transition:
    background-color var(--duration-base) var(--ease-plain),
    color var(--duration-base) var(--ease-plain);
}
.file-tab:hover {
  background: var(--color-surface-2);
}
.file-tab.active {
  background: var(--color-surface-3);
  color: var(--color-ink);
}
</style>
