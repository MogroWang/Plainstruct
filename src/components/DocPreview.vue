<script setup lang="ts">
/** 编辑器实时预览 -- iframe 内完整渲染,与构建同一管线(预览即产出) */
import { onMounted, ref, watch } from "vue";
import { useEditorStore } from "@/stores/editor";
import { useSiteStore } from "@/stores/site";
import { useThemeStore } from "@/stores/theme";
import { useAppStore } from "@/stores/app";
import { ipc } from "@/ipc/ipc";
import { renderPreview } from "@/lib/builder";
import { joinPosix } from "@/lib/paths";

const editor = useEditorStore();
const site = useSiteStore();
const theme = useThemeStore();
const app = useAppStore();

const frame = ref<HTMLIFrameElement>();

let timer: ReturnType<typeof setTimeout> | null = null;
let pendingHtml = "";
let ready = false;

function computeHtml(): string {
  if (!editor.activePath || !site.config || !theme.activeBundle) return "";
  // 传原始内容,renderPreview 内统一解析 front-matter(标题/正文)
  return renderPreview(
    site.config,
    theme.activeBundle,
    site.tree,
    site.docsCache,
    editor.activePath,
    editor.content,
    app.platform,
  );
}

/** 写入 iframe 并保持滚动位置 */
function applyHtml(next: string) {
  const win = frame.value?.contentWindow;
  const doc = frame.value?.contentDocument;
  if (!win || !doc) return;
  const savedScroll = win.scrollY;
  doc.open();
  doc.write(next);
  doc.close();
  win.scrollTo(0, savedScroll);
  attachClickHandlers();
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    pendingHtml = computeHtml();
    if (ready) applyHtml(pendingHtml);
  }, 240);
}

watch(
  [
    () => editor.content,
    () => editor.activePath,
    () => theme.activeBundle,
    () => site.config,
    () => site.tree,
  ],
  schedule,
  { immediate: true },
);

onMounted(() => {
  // about:blank 就绪后写入首次内容
  const init = () => {
    ready = true;
    applyHtml(pendingHtml);
  };
  if (frame.value?.contentDocument?.readyState === "complete") init();
  else frame.value?.addEventListener("load", init, { once: true });
});

/** 站内链接 -> 打开对应文档;外链 -> 系统浏览器 */
function attachClickHandlers() {
  const doc = frame.value?.contentDocument;
  if (!doc) return;
  doc.addEventListener("click", (e) => {
    const anchor = (e.target as HTMLElement | null)?.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href") ?? "";
    if (/^https?:/i.test(href)) {
      e.preventDefault();
      void ipc.openExternal(href);
      return;
    }
    if (href.startsWith("#")) return; // 锚点跳转交给 iframe 自身
    e.preventDefault();
    const target = anchor.getAttribute("data-doc") ?? resolveInternal(href);
    if (target) {
      const node = site.findDoc(target);
      if (node) void editor.openDoc(node);
    }
  });
}

/** 无 data-doc 的相对链接(如文件夹链接)解析为文档路径 */
function resolveInternal(href: string): string | null {
  if (!editor.activePath || href.startsWith("http")) return null;
  const clean = decodeURIComponent(href.split("#")[0]).replace(/\/+$/, "");
  if (!clean || clean === ".") return "index.md";
  const base = editor.activePath.includes("/")
    ? editor.activePath.slice(0, editor.activePath.lastIndexOf("/"))
    : "";
  const resolved = joinPosix(base, clean);
  return `${resolved}/index.md`;
}

/** 供父组件做编辑器滚动同步 */
function scrollToRatio(ratio: number) {
  const win = frame.value?.contentWindow;
  const doc = frame.value?.contentDocument;
  if (!win || !doc) return;
  const max = doc.documentElement.scrollHeight - win.innerHeight;
  if (max > 0) win.scrollTo({ top: ratio * max });
}

defineExpose({ scrollToRatio });
</script>

<template>
  <!-- sandbox 保留同源(宿主可写入/滚动/拦截点击),但禁用其中脚本:
       markdown 裸 HTML 与主题 JS 不在应用特权上下文执行 -->
  <iframe
    ref="frame"
    class="doc-preview h-full w-full border-0"
    title="preview"
    sandbox="allow-same-origin"
  />
</template>
