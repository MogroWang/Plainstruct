<script setup lang="ts">
import { computed, provide, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import type { TreeNode } from "@/ipc/types";
import { useSiteStore } from "@/stores/site";
import { useEditorStore } from "@/stores/editor";
import { useUiStore } from "@/stores/ui";
import { ipc } from "@/ipc/ipc";
import { safeName, stripExt } from "@/lib/paths";
import AppIcon from "./AppIcon.vue";
import FileTreeNode from "./FileTreeNode.vue";
import PromptModal from "./PromptModal.vue";

const { t } = useI18n();
const site = useSiteStore();
const editor = useEditorStore();
const ui = useUiStore();

const collapsed = ref(new Set<string>());
provide("treeCollapsed", collapsed);

/** 过滤掉根级 index.md(作为独立首页),其余保持不变 */
const displayTree = computed(() =>
  site.tree.filter((n) => !(n.type === "file" && n.name.toLowerCase() === "index.md")),
);

/** 编辑首页 */
function editHomepage() {
  const node = site.findDoc("index.md");
  if (node) void editor.openDoc(node);
}

/* ---------- 多选 ---------- */

const selectedPaths: Ref<Set<string>> = ref(new Set());
provide("treeSelected", selectedPaths);

const selectedCount = computed(() => selectedPaths.value.size);

function toggleSelect(path: string) {
  const next = new Set(selectedPaths.value);
  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }
  selectedPaths.value = next;
}

function clearSelection() {
  selectedPaths.value = new Set();
}

/* ---------- 收集所有文件夹路径(用于移动目标选择) ---------- */

function collectDirs(): TreeNode[] {
  const dirs: TreeNode[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (n.type === "dir") {
        dirs.push(n);
        if (n.children) walk(n.children);
      }
    }
  };
  walk(site.tree);
  return dirs;
}

/* ---------- 批量移动 ---------- */

const showMoveDialog = ref(false);

async function batchMoveTo(targetDir: string) {
  const paths = [...selectedPaths.value];
  let moved = 0;
  for (const src of paths) {
    try {
      await site.moveItem(src, targetDir);
      moved++;
    } catch (e) {
      ui.toast(t("ui.operationFailed", { msg: ipc.errText(e) }), "error");
    }
  }
  if (moved > 0) {
    ui.toast(t("tree.importDone", { n: moved }), "success");
  }
  clearSelection();
  showMoveDialog.value = false;
}

async function batchMoveToRoot() {
  await batchMoveTo("");
}

/* ---------- Prompt ---------- */

type Prompt =
  | { mode: "newDoc"; dir: string }
  | { mode: "newFolder"; parent: string }
  | { mode: "rename"; node: TreeNode }
  | null;

const prompt = ref<Prompt>(null);

const promptTitle = () =>
  prompt.value?.mode === "newDoc"
    ? t("tree.newDocTitle")
    : prompt.value?.mode === "newFolder"
      ? t("tree.newFolder")
      : t("tree.renameTitle");

const promptLabel = () =>
  prompt.value?.mode === "newDoc"
    ? t("tree.docName")
    : prompt.value?.mode === "newFolder"
      ? t("tree.folderName")
      : t("common.rename");

const promptInitial = () => {
  const p = prompt.value;
  if (p?.mode === "rename") return p.node.type === "file" ? stripExt(p.node.name) : p.node.name;
  return "";
};

async function onPromptConfirm(value: string) {
  const p = prompt.value;
  prompt.value = null;
  if (!p) return;
  const name = safeName(value);
  try {
    if (p.mode === "newDoc") {
      await site.createDoc(p.dir, name);
    } else if (p.mode === "newFolder") {
      await site.createFolder(p.parent, name);
    } else {
      await site.renameItem(p.node.path, p.node.type === "file" ? `${name}.md` : name);
    }
  } catch (e) {
    ui.toast(t("ui.operationFailed", { msg: ipc.errText(e) }), "error");
  }
}

async function onRemove(node: TreeNode) {
  const isDir = node.type === "dir";
  const ok = await ui.confirmDialog({
    title: isDir ? t("tree.deleteFolderTitle") : t("tree.deleteDocTitle"),
    body: isDir ? t("tree.deleteFolderBody", { name: node.name }) : t("tree.deleteDocBody", { name: node.name }),
    danger: true,
    confirmText: t("common.delete"),
  });
  if (!ok) return;
  try {
    await site.deleteItem(node.path);
  } catch (e) {
    ui.toast(t("ui.operationFailed", { msg: ipc.errText(e) }), "error");
  }
}

/* ---------- 导入 ---------- */

async function onImport(destDir: string = "") {
  const files = await ipc.pickImportFiles();
  if (!files?.length) return;
  try {
    const n = await site.importFiles(files, destDir);
    ui.toast(t("tree.importDone", { n }), "success");
  } catch (e) {
    ui.toast(t("ui.operationFailed", { msg: ipc.errText(e) }), "error");
  }
}

/* ---------- 外部文件拖放导入 ---------- */

async function onExternalDrop(e: DragEvent) {
  const files = e.dataTransfer?.files;
  if (!files?.length) return;
  // 过滤出支持的文件类型
  const supported = ["md", "markdown", "png", "jpg", "jpeg", "gif", "webp", "svg"];
  const filePaths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (supported.includes(ext)) {
      // 在 Tauri 环境中,我们可以通过文件路径导入
      // 浏览器 mock 环境则使用 mock 路径
      if (ipc.inTauri) {
        // Tauri 的 File 对象没有 path 属性,需要使用其他方式
        // 对于外部拖放,我们暂时跳过(需要 Tauri 的 dnd 事件支持)
        continue;
      }
      filePaths.push((f as any).path ?? f.name);
    }
  }
  if (!filePaths.length) return;
  try {
    const n = await site.importFiles(filePaths, "");
    ui.toast(t("tree.importDone", { n }), "success");
  } catch (e) {
    ui.toast(t("ui.operationFailed", { msg: ipc.errText(e) }), "error");
  }
}

/* ---------- 移动(拖拽) ---------- */

async function onMove(src: string, destDir: string) {
  try {
    await site.moveItem(src, destDir);
  } catch (e) {
    ui.toast(t("ui.operationFailed", { msg: ipc.errText(e) }), "error");
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between px-3 pb-1 pt-3">
      <span class="text-[12px] font-semibold tracking-wide text-ink-3">
        {{ t("nav.editor") }} · {{ site.docCount }}
      </span>
      <div class="flex items-center gap-0.5">
        <button class="btn-icon !h-7 !w-7" :title="t('tree.editHomepage')" @click="editHomepage">
          <AppIcon name="eye" :size="15" />
        </button>
        <button class="btn-icon !h-7 !w-7" :title="t('tree.newDoc')" @click="prompt = { mode: 'newDoc', dir: '' }">
          <AppIcon name="filePlus" :size="15" />
        </button>
        <button class="btn-icon !h-7 !w-7" :title="t('tree.newFolder')" @click="prompt = { mode: 'newFolder', parent: '' }">
          <AppIcon name="folderPlus" :size="15" />
        </button>
        <button class="btn-icon !h-7 !w-7" :title="t('tree.importFiles')" @click="onImport('')">
          <AppIcon name="download" :size="15" />
        </button>
      </div>
    </div>

    <!-- 批量操作工具栏 -->
    <div
      v-if="selectedCount > 0"
      class="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2"
    >
      <span class="text-[12px] font-medium text-ink-2">{{ t("tree.selected", { n: selectedCount }) }}</span>
      <div class="ml-auto flex items-center gap-1">
        <button class="btn btn-sm btn-secondary text-[11.5px]" @click="showMoveDialog = true">
          <AppIcon name="folder" :size="13" />
          {{ t("tree.moveTo") }}
        </button>
        <button class="btn btn-sm btn-secondary text-[11.5px]" @click="batchMoveToRoot">
          <AppIcon name="arrowRight" :size="13" />
          {{ t("tree.moveToRoot") }}
        </button>
        <button class="btn-icon !h-6 !w-6" :title="t('tree.deselect')" @click="clearSelection">
          <AppIcon name="x" :size="13" />
        </button>
      </div>
    </div>

    <div
      class="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
      @dragover.prevent
      @drop.prevent="(e: DragEvent) => {
        const src = e.dataTransfer?.getData('text/plain');
        if (src) onMove(src, '');
        else onExternalDrop(e);
      }"
    >
      <p v-if="!displayTree.length && !site.treeLoading" class="px-2 py-8 text-center text-[12.5px] leading-relaxed text-ink-3">
        {{ t("tree.empty") }}
      </p>
      <template v-else>
        <FileTreeNode
          v-for="node in displayTree"
          :key="node.path"
          :node="node"
          :depth="0"
          :selected-paths="selectedPaths"
          @new-doc-in="(dir: string) => (prompt = { mode: 'newDoc', dir })"
          @rename="(n: TreeNode) => (prompt = { mode: 'rename', node: n })"
          @remove="onRemove"
          @move="onMove"
          @toggle-select="toggleSelect"
          @import-to="(dir: string) => onImport(dir)"
        />
      </template>
    </div>

    <PromptModal
      :open="prompt !== null"
      :title="promptTitle()"
      :label="promptLabel()"
      :placeholder="t('tree.namePlaceholder')"
      :initial="promptInitial()"
      :confirm-text="prompt?.mode === 'newDoc' || prompt?.mode === 'newFolder' ? t('common.create') : t('common.confirm')"
      @confirm="onPromptConfirm"
      @cancel="prompt = null"
    />

    <!-- 移动目标文件夹选择对话框 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showMoveDialog" class="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div class="absolute inset-0 bg-[rgba(28,25,23,0.32)]" @click="showMoveDialog = false" />
          <div class="modal-card panel relative w-full max-w-[360px] shadow-window">
            <header class="px-6 pb-2 pt-5">
              <h2 class="text-[16px] font-semibold">{{ t("tree.moveToFolder") }}</h2>
            </header>
            <div class="max-h-[300px] overflow-y-auto px-6 pb-2">
              <button
                class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13.5px] hover:bg-surface-2"
                @click="batchMoveTo('')"
              >
                <AppIcon name="folder" :size="15" class="text-ink-3" />
                {{ t("tree.moveToRoot") }}
              </button>
              <button
                v-for="dir in collectDirs()"
                :key="dir.path"
                class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13.5px] hover:bg-surface-2"
                :disabled="selectedPaths.has(dir.path)"
                @click="batchMoveTo(dir.path)"
              >
                <AppIcon name="folder" :size="15" class="text-ink-3" />
                <span class="truncate">{{ dir.path }}</span>
              </button>
              <p v-if="collectDirs().length === 0" class="py-4 text-center text-[12.5px] text-ink-3">
                {{ t("tree.empty") }}
              </p>
            </div>
            <footer class="flex justify-end gap-2 border-t border-line px-6 py-4">
              <button class="btn btn-secondary" @click="showMoveDialog = false">{{ t("common.cancel") }}</button>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>