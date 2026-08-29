<script setup lang="ts">
/** 通用代码编辑器(主题制作器用):html / css / json */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorView, keymap } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as tg } from "@lezer/highlight";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { registerCmView, unregisterCmView } from "@/lib/contextMenu";

const props = defineProps<{ modelValue: string; language: "html" | "css" | "json" | "markdown" }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const host = ref<HTMLElement>();
let view: EditorView | null = null;
let lastLocal = "";
let lastLang = props.language;
const langComp = new Compartment();

const highlight = HighlightStyle.define([
  { tag: [tg.keyword, tg.moduleKeyword, tg.operatorKeyword], color: "var(--color-ink)", fontWeight: "600" },
  { tag: [tg.string, tg.special(tg.string)], color: "#0f766e" },
  { tag: [tg.number, tg.bool], color: "#92400e" },
  { tag: [tg.comment], color: "var(--color-ink-3)", fontStyle: "italic" },
  { tag: [tg.tagName], color: "var(--color-ink)", fontWeight: "600" },
  { tag: [tg.attributeName], color: "var(--color-ink-2)" },
  { tag: [tg.attributeValue], color: "#0f766e" },
  { tag: [tg.propertyName], color: "var(--color-ink-2)" },
  { tag: [tg.className], color: "#1d4ed8" },
  { tag: [tg.variableName], color: "var(--color-ink-2)" },
  { tag: [tg.definition(tg.variableName)], color: "var(--color-ink)" },
  { tag: [tg.punctuation, tg.bracket], color: "var(--color-ink-3)" },
]);

function langExtension() {
  switch (props.language) {
    case "html":
      return html();
    case "css":
      return css();
    case "json":
      return json();
    default:
      return markdown();
  }
}

onMounted(() => {
  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        langComp.of(langExtension()),
        syntaxHighlighting(highlight),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            lastLocal = u.state.doc.toString();
            emit("update:modelValue", lastLocal);
          }
        }),
      ],
    }),
    parent: host.value!,
  });
  registerCmView(host.value!, view);
});

// 语言或外部内容变化时整体替换
watch(
  () => [props.modelValue, props.language],
  () => {
    if (!view) return;
    const langChanged = props.language !== lastLang;
    if (!langChanged && props.modelValue === lastLocal) return;
    lastLang = props.language;
    const current = view.state.doc.toString();
    view.dispatch({
      changes: { from: 0, to: current.length, insert: props.modelValue },
      ...(langChanged ? { effects: langComp.reconfigure(langExtension()) } : {}),
    });
  },
);

onBeforeUnmount(() => {
  if (host.value) unregisterCmView(host.value);
  view?.destroy();
  view = null;
});
</script>

<template>
  <div ref="host" class="code-editor h-full overflow-hidden" />
</template>
