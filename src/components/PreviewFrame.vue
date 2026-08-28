<script setup lang="ts">
/** 构建产物预览:Tauri 下走 site:// 协议(与发布完全一致),浏览器 mock 降级为首页渲染 */
import { computed, onMounted, ref, watch } from "vue";
import { useAppStore } from "@/stores/app";
import { useBuilderStore } from "@/stores/builder";
import { useSiteStore } from "@/stores/site";
import { useThemeStore } from "@/stores/theme";
import { ipc } from "@/ipc/ipc";
import { buildIndexUrl } from "@/lib/preview";
import { renderPreview, collectDocPaths } from "@/lib/builder";

const app = useAppStore();
const builder = useBuilderStore();
const site = useSiteStore();
const theme = useThemeStore();

const frame = ref<HTMLIFrameElement>();

const src = computed(() => (ipc.inTauri ? buildIndexUrl(app.platform) : "about:blank"));

const reloadKey = computed(() => builder.previewNonce);

/** mock 模式:渲染首页写入 iframe */
function applyMock() {
  if (ipc.inTauri || !frame.value) return;
  const paths = collectDocPaths(site.tree);
  if (!paths.length || !site.config || !theme.activeBundle) return;
  const first = paths.includes("index.md") ? "index.md" : paths[0];
  const html = renderPreview(site.config, theme.activeBundle, site.tree, site.docsCache, first, undefined, app.platform);
  const doc = frame.value.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
}

/** 重新加载站点(协议响应带 no-store,重设 src 即取最新产物) */
function reloadSite() {
  if (!frame.value) return;
  // iframe 与应用跨源,不能调用 contentWindow.location.reload(),重设 src 触发重新导航
  frame.value.src = src.value;
}

onMounted(applyMock);

watch(reloadKey, () => {
  if (ipc.inTauri) {
    reloadSite();
  } else {
    applyMock();
  }
});
</script>

<template>
  <iframe
    ref="frame"
    :src="src"
    class="h-full w-full border-0 bg-white"
    title="site preview"
  />
</template>
