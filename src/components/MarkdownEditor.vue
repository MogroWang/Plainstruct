<script setup lang="ts">
/** CodeMirror 6 Markdown 编辑器 -- 格式工具栏 + 快捷键 + 列表续行,素构浅色高亮 */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as tg } from "@lezer/highlight";
import { useEditorStore } from "@/stores/editor";
import AppIcon from "@/components/AppIcon.vue";

const { t } = useI18n();
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

/* ---------- 选区编辑辅助 ---------- */

/** 提交一次变更并聚焦;sel 为相对变更后的绝对位置 */
function commit(from: number, to: number, insert: string, anchor: number, head: number) {
  if (!view) return;
  view.dispatch({ changes: { from, to, insert }, selection: { anchor, head }, scrollIntoView: true });
  view.focus();
}

/** 包裹/解除包裹选区;无选区时插入一对符号并置于中间 */
function wrapSelection(before: string, after: string = before) {
  if (!view) return;
  const { state } = view;
  const range = state.selection.main;
  const text = state.sliceDoc(range.from, range.to);
  if (
    text.length >= before.length + after.length &&
    text.startsWith(before) &&
    text.endsWith(after)
  ) {
    const inner = text.slice(before.length, text.length - after.length);
    commit(range.from, range.to, inner, range.from + before.length, range.from + before.length + inner.length);
    return;
  }
  const beforeText = state.sliceDoc(Math.max(0, range.from - before.length), range.from);
  const afterText = state.sliceDoc(range.to, Math.min(state.doc.length, range.to + after.length));
  if (beforeText === before && afterText === after) {
    commit(range.from - before.length, range.to + after.length, text, range.from - before.length, range.from - before.length + text.length);
    return;
  }
  const insert = before + text + after;
  commit(range.from, range.to, insert, range.from + before.length, range.from + before.length + text.length);
}

/* ---------- 行级编辑辅助 ---------- */

const LIST_RE = /^(\s*)(?:[-*+]\s+|\d+[.)]\s+)(?:\[[ xX]\]\s+)?/;
const hasBullet = (l: string) => /^(\s*)[-*+]\s+(?!\[[ xX]\]\s)/.test(l);
const hasOrdered = (l: string) => /^(\s*)\d+[.)]\s+/.test(l);
const hasTask = (l: string) => /^(\s*)[-*+]\s+\[[ xX]\]\s+/.test(l);
const QUOTE_RE = /^>\s?/;

/** 对选区覆盖的每一行应用变换 */
function transformLines(fn: (line: string, index: number, lines: string[]) => string) {
  if (!view) return;
  const { state } = view;
  const range = state.selection.main;
  const first = state.doc.lineAt(range.from);
  const last = state.doc.lineAt(range.to);
  const lines: string[] = [];
  for (let n = first.number; n <= last.number; n++) lines.push(state.doc.line(n).text);
  const next = lines.map(fn);
  if (next.every((l, i) => l === lines[i])) return;
  const insert = next.join("\n");
  commit(first.from, last.to, insert, first.from + insert.length, first.from + insert.length);
}

function toggleBullet() {
  transformLines((l, _i, lines) => {
    const stripped = l.replace(LIST_RE, "$1");
    return lines.every(hasBullet) ? stripped : stripped.replace(/^(\s*)/, "$1- ");
  });
}

function toggleOrdered() {
  transformLines((l, i, lines) => {
    const stripped = l.replace(LIST_RE, "$1");
    return lines.every(hasOrdered) ? stripped : stripped.replace(/^(\s*)/, `$1${i + 1}. `);
  });
}

function toggleTask() {
  transformLines((l, _i, lines) => {
    const stripped = l.replace(LIST_RE, "$1");
    return lines.every(hasTask) ? stripped : stripped.replace(/^(\s*)/, "$1- [ ] ");
  });
}

function toggleQuote() {
  transformLines((l, _i, lines) => {
    const stripped = l.replace(QUOTE_RE, "");
    return lines.every((x) => QUOTE_RE.test(x)) ? stripped : `> ${stripped}`;
  });
}

function setHeading(level: number) {
  transformLines((l, _i, lines) => {
    const m = l.match(/^(#{1,6})\s+/);
    const stripped = m ? l.slice(m[0].length) : l;
    const allLevel = lines.every((x) => x.match(/^#{1,6}\s+/)?.[1].length === level);
    return allLevel ? stripped : `${"#".repeat(level)} ${stripped}`;
  });
}

/* ---------- 插入类 ---------- */

function insertLink() {
  if (!view) return;
  const { state } = view;
  const range = state.selection.main;
  const text = state.sliceDoc(range.from, range.to) || t("editor.toolbar.linkText");
  const insert = `[${text}](https://)`;
  const urlFrom = range.from + text.length + 3;
  commit(range.from, range.to, insert, urlFrom, urlFrom + 8);
}

function insertImage() {
  if (!view) return;
  const range = view.state.selection.main;
  const alt = t("editor.toolbar.imageAlt");
  const insert = `![${alt}](https://)`;
  commit(range.from, range.to, insert, range.from + 2, range.from + 2 + alt.length);
}

function toggleCodeBlock() {
  if (!view) return;
  const { state } = view;
  const range = state.selection.main;
  const text = state.sliceDoc(range.from, range.to);
  if (text.startsWith("```\n") && text.endsWith("\n```")) {
    const inner = text.slice(4, -4);
    commit(range.from, range.to, inner, range.from, range.from + inner.length);
    return;
  }
  const insert = `\`\`\`\n${text}\n\`\`\``;
  commit(range.from, range.to, insert, range.from + 4, range.from + 4 + text.length);
}

function insertTable() {
  if (!view) return;
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.to);
  const head1 = t("editor.toolbar.tableHeader");
  const cell = t("editor.toolbar.tableCell");
  const header = `| ${head1} | ${head1} | ${head1} |`;
  const insert = `${line.text.trim() ? "\n" : ""}${header}\n| --- | --- | --- |\n| ${cell} | ${cell} | ${cell} |`;
  const from = line.to;
  const anchor = from + 2;
  commit(from, from, insert, anchor, anchor + head1.length);
}

function insertDivider() {
  if (!view) return;
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.to);
  const prefix = line.text.trim() ? "\n\n" : "";
  const insert = `${prefix}---\n`;
  commit(line.to, line.to, insert, line.to + insert.length, line.to + insert.length);
}

/* ---------- 列表续行:Enter 延续前缀,空项退出 ---------- */

function continueList(v: EditorView): boolean {
  const { state } = v;
  const main = state.selection.main;
  const line = state.doc.lineAt(main.head);
  const m = line.text.match(/^(\s*)(?:([-*+])\s+|(\d+)([.)])\s+)(\[[ xX]\]\s+)?/);
  if (!m) return false;
  if (main.head < line.from + m[0].length) return false;
  // 空列表项:清除标记,退出列表
  if (line.text.slice(m[0].length).trim() === "") {
    v.dispatch({ changes: { from: line.from, to: line.to }, selection: { anchor: line.from } });
    return true;
  }
  const bullet = m[2] ? `${m[2]} ` : `${m[3]}${m[4]} `;
  const task = m[5] ? "[ ] " : "";
  const insert = `\n${m[1]}${bullet}${task}`;
  v.dispatch({
    changes: [{ from: main.from, to: main.to, insert }],
    selection: { anchor: main.from + insert.length },
    scrollIntoView: true,
  });
  return true;
}

/* ---------- 初始化 ---------- */

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
          { key: "Mod-b", run: () => (wrapSelection("**"), true) },
          { key: "Mod-i", run: () => (wrapSelection("*"), true) },
          { key: "Enter", run: continueList },
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
  <div class="flex h-full min-h-0 flex-col bg-surface">
    <!-- 格式工具栏 -->
    <div class="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-line px-2">
      <button class="tb-btn tb-text" :title="t('editor.toolbar.heading', { n: 1 })" @click="setHeading(1)">H1</button>
      <button class="tb-btn tb-text" :title="t('editor.toolbar.heading', { n: 2 })" @click="setHeading(2)">H2</button>
      <button class="tb-btn tb-text" :title="t('editor.toolbar.heading', { n: 3 })" @click="setHeading(3)">H3</button>
      <span class="tb-sep" />
      <button class="tb-btn tb-text font-bold" :title="t('editor.toolbar.bold')" @click="wrapSelection('**')">B</button>
      <button class="tb-btn tb-text italic" :title="t('editor.toolbar.italic')" @click="wrapSelection('*')">I</button>
      <button class="tb-btn tb-text line-through" :title="t('editor.toolbar.strikethrough')" @click="wrapSelection('~~')">S</button>
      <button class="tb-btn" :title="t('editor.toolbar.inlineCode')" @click="wrapSelection('`')">
        <AppIcon name="code" :size="15" />
      </button>
      <span class="tb-sep" />
      <button class="tb-btn" :title="t('editor.toolbar.quote')" @click="toggleQuote">
        <AppIcon name="quote" :size="15" />
      </button>
      <button class="tb-btn" :title="t('editor.toolbar.bulletList')" @click="toggleBullet">
        <AppIcon name="listBullet" :size="15" />
      </button>
      <button class="tb-btn" :title="t('editor.toolbar.orderedList')" @click="toggleOrdered">
        <AppIcon name="listOrdered" :size="15" />
      </button>
      <button class="tb-btn" :title="t('editor.toolbar.taskList')" @click="toggleTask">
        <AppIcon name="checkSquare" :size="15" />
      </button>
      <span class="tb-sep" />
      <button class="tb-btn" :title="t('editor.toolbar.link')" @click="insertLink">
        <AppIcon name="link" :size="15" />
      </button>
      <button class="tb-btn" :title="t('editor.toolbar.image')" @click="insertImage">
        <AppIcon name="image" :size="15" />
      </button>
      <button class="tb-btn" :title="t('editor.toolbar.codeBlock')" @click="toggleCodeBlock">
        <AppIcon name="squareCode" :size="15" />
      </button>
      <span class="tb-sep" />
      <button class="tb-btn" :title="t('editor.toolbar.table')" @click="insertTable">
        <AppIcon name="table" :size="15" />
      </button>
      <button class="tb-btn" :title="t('editor.toolbar.divider')" @click="insertDivider">
        <AppIcon name="minus" :size="15" />
      </button>
    </div>

    <div ref="host" class="min-h-0 flex-1 overflow-hidden" />
  </div>
</template>

<style scoped>
.tb-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 4px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--color-ink-3);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-base) var(--ease-plain),
    color var(--duration-base) var(--ease-plain);
}
.tb-btn:hover {
  background: var(--color-surface-2);
  color: var(--color-ink);
}
.tb-text {
  font-family: var(--font-sans);
}
.tb-sep {
  flex-shrink: 0;
  width: 1px;
  height: 14px;
  margin: 0 4px;
  background: var(--color-line);
}
</style>
