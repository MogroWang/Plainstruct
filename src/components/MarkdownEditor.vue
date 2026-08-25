<script setup lang="ts">
/** CodeMirror 6 Markdown 编辑器 -- 素构浅色高亮,行宽折行 */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as tg } from "@lezer/highlight";
import { useEditorStore } from "@/stores/editor";

const editor = useEditorStore();
const host = ref<HTMLElement>();
let view: EditorView | null = null;

const plainHighlight = HighlightStyle.define([
  { tag: tg.heading, fontWeight: "600", color: "var(--color-ink)" },
  { tag: [tg.heading1], fontWeight: "700", fontSize: "1.18em" },
  { tag: [tg.heading2], fontWeight: "650", fontSize: "1.1em" },
  { tag: tg.strong, fontWeight: "650" },
  { tag: tg.emphasis, fontStyle: "italic" },
  { tag: tg.link, color: "var(--color-accent)", textDecoration: "underline" },
  { tag: [tg.monospace, tg.inserted], fontFamily: "var(--font-mono)", color: "var(--color-ink-2)" },
  { tag: [tg.quote], color: "var(--color-ink-2)", fontStyle: "italic" },
  { tag: [tg.meta, tg.processingInstruction, tg.comment], color: "var(--color-ink-3)" },
  { tag: tg.strikethrough, textDecoration: "line-through", color: "var(--color-ink-3)" },
]);

onMounted(() => {
  view = new EditorView({
    state: EditorState.create({
      doc: editor.content,
      extensions: [
        history(),
        keymap.of([
          {
            key: "Mod-s",
            run: () => {
              void editor.save();
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        highlightSelectionMatches(),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(plainHighlight),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) editor.onInput(u.state.doc.toString());
        }),
      ],
    }),
    parent: host.value!,
  });
});

// 打开新文档时整体替换(不触发自动保存回路)
watch(
  () => editor.activePath,
  () => {
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== editor.content) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: editor.content } });
    }
  },
);

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});

defineExpose({
  scroller: () => view?.scrollDOM ?? null,
});
</script>

<template>
  <div ref="host" class="markdown-editor h-full overflow-hidden" />
</template>
