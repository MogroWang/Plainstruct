<script setup lang="ts">
import { computed, inject, ref, type Ref } from "vue";
import type { TreeNode } from "@/ipc/types";
import { useEditorStore } from "@/stores/editor";
import AppIcon from "./AppIcon.vue";

defineOptions({ name: "FileTreeNode" });

const props = defineProps<{ node: TreeNode; depth: number }>();

const emit = defineEmits<{
  newDocIn: [dir: string];
  rename: [node: TreeNode];
  remove: [node: TreeNode];
  move: [src: string, destDir: string];
}>();

const editor = useEditorStore();
const collapsed = inject<Ref<Set<string>>>("treeCollapsed", ref(new Set()));
const dragOver = ref(false);
let dragDepth = 0;

const isDir = computed(() => props.node.type === "dir");
const label = computed(() => (isDir.value ? props.node.name : props.node.name.replace(/\.md$/i, "")));
const isActive = computed(() => !isDir.value && editor.activePath === props.node.path);
const isCollapsed = computed(() => collapsed.value.has(props.node.path));

function toggle() {
  const next = new Set(collapsed.value);
  if (next.has(props.node.path)) next.delete(props.node.path);
  else next.add(props.node.path);
  collapsed.value = next;
}

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData("text/plain", props.node.path);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
}

function onDragOver(e: DragEvent) {
  if (!isDir.value) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  dragDepth++;
  dragOver.value = true;
}

function onDragLeave() {
  if (--dragDepth <= 0) {
    dragOver.value = false;
    dragDepth = 0;
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragOver.value = false;
  dragDepth = 0;
  const src = e.dataTransfer?.getData("text/plain");
  if (src && src !== props.node.path) emit("move", src, props.node.path);
}
</script>

<template>
  <div>
    <div
      class="tree-row group flex h-[30px] cursor-default items-center gap-1 rounded-md pr-1"
      :class="{ active: isActive, 'drag-over': dragOver }"
      :style="{ paddingLeft: depth * 14 + 4 + 'px' }"
      :draggable="true"
      :title="node.name"
      @click="isDir ? toggle() : editor.openDoc(node)"
      @dragstart="onDragStart"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
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

      <span class="row-actions flex items-center opacity-0">
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
          @new-doc-in="(d: string) => emit('newDocIn', d)"
          @rename="(n: TreeNode) => emit('rename', n)"
          @remove="(n: TreeNode) => emit('remove', n)"
          @move="(s: string, d: string) => emit('move', s, d)"
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
.tree-row:hover .row-actions {
  opacity: 1;
}
.row-actions {
  transition: opacity var(--duration-base) var(--ease-plain);
}
</style>
