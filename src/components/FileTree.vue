<script setup lang="ts">
import { provide, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { TreeNode } from "@/ipc/types";
import { useSiteStore } from "@/stores/site";
import { useUiStore } from "@/stores/ui";
import { ipc } from "@/ipc/ipc";
import { safeName, stripExt } from "@/lib/paths";
import AppIcon from "./AppIcon.vue";
import FileTreeNode from "./FileTreeNode.vue";
import PromptModal from "./PromptModal.vue";

const { t } = useI18n();
const site = useSiteStore();
const ui = useUiStore();

const collapsed = ref(new Set<string>());
provide("treeCollapsed", collapsed);

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

async function onImport() {
  const files = await ipc.pickImportFiles();
  if (!files?.length) return;
  try {
    const n = await site.importFiles(files, "");
    ui.toast(t("tree.importDone", { n }), "success");
  } catch (e) {
    ui.toast(t("ui.operationFailed", { msg: ipc.errText(e) }), "error");
  }
}

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
        <button class="btn-icon !h-7 !w-7" :title="t('tree.newDoc')" @click="prompt = { mode: 'newDoc', dir: '' }">
          <AppIcon name="filePlus" :size="15" />
        </button>
        <button class="btn-icon !h-7 !w-7" :title="t('tree.newFolder')" @click="prompt = { mode: 'newFolder', parent: '' }">
          <AppIcon name="folderPlus" :size="15" />
        </button>
        <button class="btn-icon !h-7 !w-7" :title="t('tree.importFiles')" @click="onImport">
          <AppIcon name="download" :size="15" />
        </button>
      </div>
    </div>

    <div
      class="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
      @dragover.prevent
      @drop.prevent="onMove($event.dataTransfer?.getData('text/plain') ?? '', '')"
    >
      <p v-if="!site.tree.length && !site.treeLoading" class="px-2 py-8 text-center text-[12.5px] leading-relaxed text-ink-3">
        {{ t("tree.empty") }}
      </p>
      <template v-else>
        <FileTreeNode
          v-for="node in site.tree"
          :key="node.path"
          :node="node"
          :depth="0"
          @new-doc-in="(dir: string) => (prompt = { mode: 'newDoc', dir })"
          @rename="(n: TreeNode) => (prompt = { mode: 'rename', node: n })"
          @remove="onRemove"
          @move="onMove"
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
  </div>
</template>
