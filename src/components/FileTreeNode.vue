<script setup lang="ts">
import { computed, inject, ref, type Ref } from "vue";
import type { TreeNode } from "@/ipc/types";
import { dirname } from "@/lib/paths";
import { useEditorStore } from "@/stores/editor";
import AppIcon from "./AppIcon.vue";

export interface SelectClick {
  path: string;
  ctrl: boolean;
  shift: boolean;
}

defineOptions({ name: "FileTreeNode" });

const props = defineProps<{
  node: TreeNode;
  depth: number;
  selectedPaths: Set<string>;
  selectMode: boolean;
}>();

const emit = defineEmits<{
  newDocIn: [dir: string];
  rename: [node: TreeNode];
  remove: [node: TreeNode];
  move: [src: string, destDir: string];
  selectClick: [click: SelectClick];
  importTo: [dir: string];
}>();

const editor = useEditorStore();
const collapsed = inject<Ref<Set<string>>>("treeCollapsed", ref(new Set()));
const dragOver = ref(false);
const dragging = ref(false);
let expandTimer: number | undefined;

const isDir = computed(() => props.node.type === "dir");
const label = computed(() => (isDir.value ? props.node.name : props.node.name.replace(/\.md$/i, "")));
const isActive = computed(() => !isDir.value && editor.activePath === props.node.path);
const isCollapsed = computed(() => collapsed.value.has(props.node.path));
const isSelected = computed(() => props.selectedPaths.has(props.node.path));

function toggle() {
  const next = new Set(collapsed.value);
  if (next.has(props.node.path)) next.delete(props.node.path);
  else next.add(props.node.path);
  collapsed.value = next;
}

function onRowClick(e: MouseEvent) {
  if (props.selectMode) {
    emit("selectClick", { path: props.node.path, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey });
    return;
  }
  if (isDir.value) toggle();
  else editor.openDoc(props.node);
}

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData("text/plain", props.node.path);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  dragging.value = true;
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  dragOver.value = true;
  // 悬停在折叠文件夹上稍候自动展开,便于继续拖入更深层级
  if (expandTimer === undefined) {
    expandTimer = window.setTimeout(() => {
      expandTimer = undefined;
      if (isDir.value && isCollapsed.value) {
        const next = new Set(collapsed.value);
        next.delete(props.node.path);
        collapsed.value = next;
      }
    }, 600);
  }
}

function endDrag(e?: DragEvent) {
  // 行内子元素间移动触发的 dragleave 不清高亮,避免闪烁
  if (e && e.relatedTarget instanceof Node && e.currentTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
  dragOver.value = false;
  if (expandTimer !== undefined) {
    window.clearTimeout(expandTimer);
    expandTimer = undefined;
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  endDrag();
  const src = e.dataTransfer?.getData("text/plain");
  if (!src) return;
  const targetDir = isDir.value ? props.node.path : dirname(props.node.path);
  if (src !== targetDir) emit("move", src, targetDir);
}
</script>

<template>
  <div>
    <div
      class="tree-row group flex h-[30px] cursor-default items-center gap-1 rounded-md pr-1 select-none"
      :class="{
        active: isActive,
        'drag-over': dragOver,
        'bg-surface-2': isSelected,
        'opacity-40': dragging,
      }"
      :style="{ paddingLeft: depth * 14 + 4 + 'px' }"
      :draggable="true"
      :data-path="node.path"
      :title="node.name"
      @click="onRowClick"
      @dragstart="onDragStart"
      @dragend="endDrag"
      @dragover="onDragOver"
      @dragleave="endDrag"
      @drop="onDrop"
    >
      <!-- 多选模式:状态复选框 -->
      <button
        v-if="selectMode"
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded"
        :class="isSelected ? 'text-ink' : 'text-ink-3 opacity-60'"
        tabindex="-1"
        @click.stop="emit('selectClick', { path: node.path, ctrl: true, shift: false })"
      >
        <AppIcon :name="isSelected ? 'checkSquare' : 'square'" :size="13" />
      </button>

      <!-- 展开/折叠 -->
      <button
        v-if="isDir"
        class="btn-icon !h-5 !w-5 !text-ink-3"
        :title="isCollapsed ? '展开' : '折叠'"
        tabindex="-1"
        @click.stop="toggle"
      >
        <AppIcon :name="isCollapsed ? 'chevronRight' : 'chevronDown'" :size="13" />
      </button>
      <span v-else class="w-5" />

      <AppIcon :name="isDir ? 'folder' : 'doc'" :size="15" class="shrink-0 text-ink-3" :class="{ 'text-ink-2': isDir }" />
      <span class="min-w-0 flex-1 truncate text-[13px]" :class="isActive ? 'font-medium' : ''">
        {{ label }}
      </span>

      <span v-if="!selectMode" class="row-actions flex items-center opacity-0">
        <button v-if="isDir" class="btn-icon !h-6 !w-6" :title="$t('tree.importToFolder')" tabindex="-1" @click.stop="emit('importTo', node.path)">
          <AppIcon name="download" :size="13" />
        </button>
        <button v-if="isDir" class="btn-icon !h-6 !w-6" :title="$t('tree.newDoc')" tabindex="-1" @click.stop="emit('newDocIn', node.path)">
          <AppIcon name="filePlus" :size="13" />
        </button>
        <button class="btn-icon !h-6 !w-6" :title="$t('tree.rename')" tabindex="-1" @click.stop="emit('rename', node)">
          <AppIcon name="pencil" :size="13" />
        </button>
        <button class="btn-icon !h-6 !w-6 hover:!text-danger" :title="$t('tree.delete')" tabindex="-1" @click.stop="emit('remove', node)">
          <AppIcon name="trash" :size="13" />
        </button>
      </span>
    </div>

    <div v-if="isDir" class="tree-group" :data-collapsed="isCollapsed">
      <div>
        <FileTreeNode
          v-for="child in node.children"
          :key="child.path"
          :node="child"
          :depth="depth + 1"
          :selected-paths="selectedPaths"
          :select-mode="selectMode"
          @new-doc-in="(d: string) => emit('newDocIn', d)"
          @rename="(n: TreeNode) => emit('rename', n)"
          @remove="(n: TreeNode) => emit('remove', n)"
          @move="(s: string, d: string) => emit('move', s, d)"
          @select-click="(c: SelectClick) => emit('selectClick', c)"
          @import-to="(d: string) => emit('importTo', d)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-row:hover {
  background: var(--color-surface-2);
}
.tree-row.active {
  background: var(--color-surface-3);
}
.tree-row.drag-over {
  background: var(--color-accent-soft);
  outline: 1px dashed var(--color-line-strong);
  outline-offset: -2px;
}
.row-actions {
  transition: opacity var(--duration-base) var(--ease-plain);
}
.tree-row:hover .row-actions {
  opacity: 1;
}
</style>
