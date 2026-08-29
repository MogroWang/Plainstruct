<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import type { TreeNode } from "@/ipc/types";
import { useSiteStore } from "@/stores/site";
import { useEditorStore } from "@/stores/editor";
import { useUiStore } from "@/stores/ui";
import { useContextMenuStore, type MenuItem } from "@/stores/contextMenu";
import { ipc } from "@/ipc/ipc";
import { dirname, safeName, stripExt } from "@/lib/paths";
import AppIcon from "./AppIcon.vue";
import FileTreeNode, { type DropMark, type SelectClick } from "./FileTreeNode.vue";
import PromptModal from "./PromptModal.vue";

const { t } = useI18n();
const site = useSiteStore();
const editor = useEditorStore();
const ui = useUiStore();
const ctxMenu = useContextMenuStore();

const collapsed = ref(new Set<string>());
provide("treeCollapsed", collapsed);

/** 拖拽落点指示(行插入线 / 移入文件夹 / 根目录末尾) */
const dropMark = ref<DropMark>(null);
provide("treeDropMark", dropMark);

/** 过滤掉根级 index.md(作为独立首页),其余保持不变 */
const displayTree = computed(() =>
  site.tree.filter((n) => !(n.type === "file" && n.name.toLowerCase() === "index.md")),
);

/* ---------- 固定首页入口 ---------- */

const homeNode = computed(() => site.findDoc("index.md"));
const homeActive = computed(
  () => !!editor.activePath && editor.activePath.toLowerCase() === "index.md",
);

/** 编辑首页;根目录没有 index.md 时创建一篇 */
async function openHomepage() {
  if (homeNode.value) {
    await editor.openDoc(homeNode.value);
    return;
  }
  try {
    await site.createDoc("", "index", t("tree.homeDocTitle"));
    ui.toast(t("tree.homeCreated"), "success");
  } catch (e) {
    ui.toast(t("ui.operationFailed", { msg: ipc.errText(e) }), "error");
  }
}

/* ---------- 多选模式 ---------- */

const selectMode = ref(false);
const selectedPaths: Ref<Set<string>> = ref(new Set());
provide("treeSelected", selectedPaths);

const selectedCount = computed(() => selectedPaths.value.size);
/** Shift 范围选择的起点 */
const anchor = ref<string | null>(null);

/** 树的扁平显示顺序(范围选择用) */
function flattenPaths(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      out.push(n.path);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

function setSelectMode(on: boolean) {
  selectMode.value = on;
  anchor.value = null;
  if (!on) selectedPaths.value = new Set();
}

/** 多选模式下的行点击:普通 = 单选,Ctrl/⌘ = 切换,Shift = 从锚点范围选择 */
function handleSelectClick(click: SelectClick) {
  if (click.shift && anchor.value) {
    const flat = flattenPaths(displayTree.value);
    const a = flat.indexOf(anchor.value);
    const b = flat.indexOf(click.path);
    if (a >= 0 && b >= 0) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      selectedPaths.value = new Set(flat.slice(lo, hi + 1));
      return;
    }
  }
  if (click.ctrl) {
    anchor.value = click.path;
    const next = new Set(selectedPaths.value);
    if (next.has(click.path)) next.delete(click.path);
    else next.add(click.path);
    selectedPaths.value = next;
    return;
  }
  anchor.value = click.path;
  selectedPaths.value = new Set([click.path]);
}

/* ---------- 框选(空白处按下拖动) ---------- */

const scrollEl = ref<HTMLElement | null>(null);
/** 选框矩形,内容坐标 */
const band = ref<{ x: number; y: number; w: number; h: number } | null>(null);
let bandStart: { x: number; y: number } | null = null;
let bandPointerId = -1;

function onBandDown(e: PointerEvent) {
  if (!selectMode.value || e.button !== 0) return;
  if ((e.target as HTMLElement | null)?.closest(".tree-row, button")) return;
  bandStart = { x: e.clientX, y: e.clientY };
  bandPointerId = e.pointerId;
  scrollEl.value?.setPointerCapture(e.pointerId);
}

function onBandMove(e: PointerEvent) {
  if (!bandStart || e.pointerId !== bandPointerId || !scrollEl.value) return;
  // 位移阈值:越过前视为原地点击,不进入框选
  if (!band.value && Math.abs(e.clientX - bandStart.x) < 4 && Math.abs(e.clientY - bandStart.y) < 4) return;
  const el = scrollEl.value;
  const rect = el.getBoundingClientRect();
  const left = Math.min(bandStart.x, e.clientX);
  const top = Math.min(bandStart.y, e.clientY);
  const right = Math.max(bandStart.x, e.clientX);
  const bottom = Math.max(bandStart.y, e.clientY);
  band.value = {
    x: left - rect.left + el.scrollLeft,
    y: top - rect.top + el.scrollTop,
    w: right - left,
    h: bottom - top,
  };
  // 与行矩形相交即选中
  const next = new Set<string>();
  el.querySelectorAll<HTMLElement>(".tree-row").forEach((row) => {
    const r = row.getBoundingClientRect();
    if (r.left < right && r.right > left && r.top < bottom && r.bottom > top) {
      const p = row.dataset.path;
      if (p) next.add(p);
    }
  });
  selectedPaths.value = next;
}

function onBandUp(e: PointerEvent) {
  if (e.pointerId !== bandPointerId) return;
  const banded = band.value !== null;
  bandStart = null;
  bandPointerId = -1;
  band.value = null;
  // 空白处原地点击(未成框) = 清除选择
  if (!banded) selectedPaths.value = new Set();
}

function onBandCancel(e: PointerEvent) {
  if (e.pointerId !== bandPointerId) return;
  bandStart = null;
  bandPointerId = -1;
  band.value = null;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && selectMode.value) setSelectMode(false);
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

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

/* ---------- 右键菜单(文件操作) ---------- */

/** 按路径在完整树中查找节点 */
function findNodeByPath(path: string): TreeNode | null {
  const walk = (nodes: TreeNode[]): TreeNode | null => {
    for (const n of nodes) {
      if (n.path === path) return n;
      const hit = n.children ? walk(n.children) : null;
      if (hit) return hit;
    }
    return null;
  };
  return walk(site.tree);
}

/** 树内右键:命中行弹出该节点的文件操作,空白处弹出根目录操作 */
function openTreeMenu(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  const row = target?.closest<HTMLElement>(".tree-row") ?? null;
  const node = row?.dataset.path ? findNodeByPath(row.dataset.path) : null;
  const dir = node ? (node.type === "dir" ? node.path : dirname(node.path)) : "";

  const items: MenuItem[] = [
    {
      id: "newDoc",
      label: t("tree.newDoc"),
      icon: "filePlus",
      run: () => (prompt.value = { mode: "newDoc", dir }),
    },
    {
      id: "newFolder",
      label: t("tree.newFolder"),
      icon: "folderPlus",
      run: () => (prompt.value = { mode: "newFolder", parent: dir }),
    },
  ];
  if (node?.type === "dir") {
    items.push({
      id: "import",
      label: t("tree.importToFolder"),
      icon: "download",
      run: () => void onImport(node.path),
    });
  } else if (!node) {
    items.push({
      id: "import",
      label: t("tree.importFiles"),
      icon: "download",
      run: () => void onImport(""),
    });
  }
  if (node) {
    items.push(
      { id: "sep", separator: true },
      {
        id: "rename",
        label: t("tree.rename"),
        icon: "pencil",
        run: () => (prompt.value = { mode: "rename", node }),
      },
      {
        id: "delete",
        label: t("tree.delete"),
        icon: "trash",
        danger: true,
        run: () => void onRemove(node),
      },
    );
  }

  e.preventDefault();
  e.stopPropagation();
  ctxMenu.show(e.clientX, e.clientY, items);
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

/* ---------- 移动(拖拽/批量) ---------- */

/** 拖动项属于多选集合时,全部选中项一起移动(排除目标自身及其祖先) */
function expandDragSrcs(src: string, destDir: string): string[] {
  if (!selectedPaths.value.has(src) || selectedPaths.value.size <= 1) return [src];
  return [...selectedPaths.value].filter(
    (s) => s !== destDir && !(destDir && destDir.startsWith(s + "/")),
  );
}

async function onMove(src: string, destDir: string) {
  let moved = 0;
  for (const s of expandDragSrcs(src, destDir)) {
    try {
      await site.moveItem(s, destDir);
      moved++;
    } catch (e) {
      ui.toast(t("ui.operationFailed", { msg: ipc.errText(e) }), "error");
    }
  }
  // 多项移动时统一提示;单项保持安静
  if (moved > 1) ui.toast(t("tree.importDone", { n: moved }), "success");
  if (moved > 0) clearSelection();
}

/* ---------- 树空白区域的拖放(移动到根目录 / 外部导入) ---------- */

function onTreeDragOver(e: DragEvent) {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.types.includes("text/plain")) {
    e.dataTransfer.dropEffect = "move";
  }
  // 落在行外空白处 = 移动到根目录,指示线挂在列表末尾;行内由节点自行标记
  if ((e.target as HTMLElement | null)?.closest?.(".tree-row")) return;
  dropMark.value = { kind: "root-end" };
}

function onTreeDragLeave(e: DragEvent) {
  const el = scrollEl.value;
  if (!el) return;
  if (e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) return;
  dropMark.value = null;
}

async function onTreeDrop(e: DragEvent) {
  e.preventDefault();
  dropMark.value = null;
  const src = e.dataTransfer?.getData("text/plain");
  if (src) {
    await onMove(src, "");
    return;
  }
  await onExternalDrop(e);
}
</script>

<template>
  <div class="flex h-full flex-col" @contextmenu="openTreeMenu">
    <div class="flex items-center justify-between px-3 pb-1 pt-3">
      <span class="text-[12px] font-semibold tracking-wide text-ink-3">
        {{ t("nav.editor") }} · {{ site.docCount }}
      </span>
      <div class="flex items-center gap-0.5">
        <button
          class="select-btn btn-icon !h-7 !w-7"
          :title="t('tree.multiSelect')"
          :aria-pressed="selectMode"
          @click="setSelectMode(!selectMode)"
        >
          <AppIcon name="checkSquare" :size="15" />
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
      <span class="shrink-0 whitespace-nowrap text-[12px] font-medium text-ink-2">{{ t("tree.selected", { n: selectedCount }) }}</span>
      <div class="ml-auto flex items-center gap-1">
        <button class="btn btn-sm btn-secondary text-[11.5px]" @click="showMoveDialog = true">
          <AppIcon name="folder" :size="13" />
          {{ t("tree.moveTo") }}
        </button>
        <button class="btn-icon !h-6 !w-6" :title="t('tree.deselect')" @click="clearSelection">
          <AppIcon name="x" :size="13" />
        </button>
      </div>
    </div>

    <!-- 固定首页入口(不随树滚动,缺失时点击创建) -->
    <div class="px-2 pb-1 pt-2">
      <div
        class="home-row flex h-[30px] cursor-default items-center gap-1 rounded-md px-1 select-none"
        :class="{ active: homeActive, 'is-missing': !homeNode }"
        :title="homeNode ? 'index.md' : t('tree.homeCreateHint')"
        @click="openHomepage"
      >
        <span class="w-5 shrink-0" />
        <AppIcon name="home" :size="15" class="home-row-icon shrink-0" :class="homeActive ? 'text-ink-2' : 'text-ink-3'" />
        <span class="min-w-0 flex-1 truncate text-[13px]" :class="homeActive ? 'font-medium' : ''">
          {{ t("tree.home") }}
        </span>
        <span v-if="!homeNode" class="shrink-0 pr-1 text-[10.5px] text-ink-3">
          {{ t("tree.homeMissing") }}
        </span>
      </div>
    </div>

    <div
      ref="scrollEl"
      class="relative min-h-0 flex-1 overflow-y-auto px-2 pb-4"
      :class="{ 'select-none': selectMode }"
      @dragover="onTreeDragOver"
      @dragleave="onTreeDragLeave"
      @drop="onTreeDrop"
      @pointerdown="onBandDown"
      @pointermove="onBandMove"
      @pointerup="onBandUp"
      @pointercancel="onBandCancel"
    >
      <!-- 框选矩形 -->
      <div
        v-if="band"
        class="band"
        :style="{ left: band.x + 'px', top: band.y + 'px', width: band.w + 'px', height: band.h + 'px' }"
      />
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
          :select-mode="selectMode"
          @new-doc-in="(dir: string) => (prompt = { mode: 'newDoc', dir })"
          @rename="(n: TreeNode) => (prompt = { mode: 'rename', node: n })"
          @remove="onRemove"
          @move="onMove"
          @select-click="handleSelectClick"
          @import-to="(dir: string) => onImport(dir)"
        />
        <!-- 拖到空白处:移动到根目录末尾的指示线 -->
        <div v-if="dropMark?.kind === 'root-end'" class="drop-line-root" aria-hidden="true" />
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

<style scoped>
/* 固定首页入口:与树行同规格,缺失时整行弱化 */
.home-row {
  transition: background-color var(--duration-base) var(--ease-plain);
}
.home-row:hover {
  background: var(--color-surface-2);
}
.home-row.active {
  background: var(--color-surface-3);
}
.home-row.is-missing .home-row-icon {
  color: var(--color-ink-3);
  opacity: 0.75;
}

/* 多选模式按钮激活态:实心墨底 */
.select-btn[aria-pressed="true"] {
  background: var(--color-accent);
  color: var(--color-surface);
}
.select-btn[aria-pressed="true"]:hover {
  background: var(--color-accent-strong);
}

/* 框选矩形 */
.band {
  position: absolute;
  z-index: 10;
  pointer-events: none;
  border: 1px solid rgba(28, 25, 23, 0.4);
  background: rgba(28, 25, 23, 0.06);
  border-radius: 3px;
}

/* 拖到空白处:根目录末尾的插入线 */
.drop-line-root {
  height: 2px;
  margin: 3px 4px 0;
  border-radius: 1px;
  background: var(--color-accent);
  pointer-events: none;
}
</style>
