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
import { registerCmView, unregisterCmView } from "@/lib/contextMenu";
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

/** 紧贴选区某一侧的连续标记字符数(限同一行,用于判断格式是否已应用) */
function markerRun(ch: string, side: "left" | "right"): number {
  if (!view) return 0;
  const { state } = view;
  const range = state.selection.main;
  const pos = side === "left" ? range.from : range.to;
  const line = state.doc.lineAt(pos);
  let n = 0;
  while (
    side === "left"
      ? pos - 1 - n >= line.from && state.sliceDoc(pos - 1 - n, pos - n) === ch
      : pos + n < line.to && state.sliceDoc(pos + n, pos + n + 1) === ch
  ) {
    n++;
  }
  return n;
}

/**
 * 行内栈式配对:扫描当前行中成对的 before...after 标记,
 * 返回包含选区(或光标)的最内层包裹;跨行或未命中返回 null。
 */
function enclosingPair(
  before: string,
  after: string,
): { from: number; to: number; innerFrom: number; innerTo: number } | null {
  if (!view) return null;
  const { state } = view;
  const range = state.selection.main;
  const line = state.doc.lineAt(range.from);
  if (state.doc.lineAt(range.to).number !== line.number) return null;
  const text = line.text;
  const localFrom = range.from - line.from;
  const localTo = range.to - line.from;
  const stack: number[] = [];
  let i = 0;
  while (i <= text.length - before.length) {
    if (text.startsWith(before, i)) {
      stack.push(i);
      i += before.length;
      continue;
    }
    if (stack.length && text.startsWith(after, i)) {
      const start = stack.pop()!;
      const innerFrom = start + before.length;
      const innerTo = i;
      if (innerTo > innerFrom && localFrom >= innerFrom && localTo <= innerTo) {
        return {
          from: line.from + start,
          to: line.from + i + after.length,
          innerFrom: line.from + innerFrom,
          innerTo: line.from + innerTo,
        };
      }
      i += after.length;
      continue;
    }
    i++;
  }
  return null;
}

/**
 * 包裹/解除包裹选区;无选区时插入一对符号并置于中间。
 * 选中文本或光标所在处已被相同格式包裹时,再次按下即取消该格式;
 * 斜体按单个 `*` 判定,连续偶数个 `*` 属于加粗标记,不算斜体已应用。
 */
function wrapSelection(before: string, after: string = before) {
  if (!view) return;
  const { state } = view;
  const range = state.selection.main;
  const text = state.sliceDoc(range.from, range.to);
  // 选区完整包含包裹对:剥离
  if (
    text.length >= before.length + after.length &&
    text.startsWith(before) &&
    text.endsWith(after)
  ) {
    const inner = text.slice(before.length, text.length - after.length);
    commit(range.from, range.to, inner, range.from + before.length, range.from + before.length + inner.length);
    return;
  }
  // 选区/光标位于同行的完整包裹对内部(部分选中、光标悬停均可):整对剥离。
  // 单个 `*` 与加粗的 `**` 字符重叠,无法无歧义配对,只走下方紧邻检测
  const pair = before === "*" ? null : enclosingPair(before, after);
  if (pair) {
    const inner = state.sliceDoc(pair.innerFrom, pair.innerTo);
    commit(pair.from, pair.to, inner, pair.innerFrom, pair.innerTo);
    return;
  }
  // 选区紧贴成对标记(包裹结构不规范时的兜底):按字符数剥离一层
  const ch = before[0];
  const ln = markerRun(ch, "left");
  const rn = markerRun(ch, "right");
  const applied =
    before === "*"
      ? ln >= 1 && rn >= 1 && ln % 2 === 1 && rn % 2 === 1
      : ln >= before.length && rn >= after.length;
  if (applied) {
    const drop = Math.min(before.length, ln, rn);
    commit(
      range.from - drop,
      range.to + drop,
      text,
      range.from - drop,
      range.from - drop + text.length,
    );
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
  // 光标/选区处于 ``` 围栏内部(未选中围栏行):移除上下围栏行,保留代码内容
  const fenceRe = /^ {0,3}```/;
  const fromLine = state.doc.lineAt(range.from);
  const toLine = state.doc.lineAt(range.to);
  if (!fenceRe.test(fromLine.text) && !fenceRe.test(toLine.text)) {
    // 选区之前的围栏行为奇数个 = 当前处于某个围栏内部
    let fencesBefore = 0;
    let openNum = 0;
    for (let n = 1; n < fromLine.number; n++) {
      if (fenceRe.test(state.doc.line(n).text)) {
        fencesBefore++;
        openNum = n;
      }
    }
    if (fencesBefore % 2 === 1) {
      for (let n = toLine.number + 1; n <= state.doc.lines; n++) {
        const close = state.doc.line(n);
        if (fenceRe.test(close.text)) {
          const open = state.doc.line(openNum);
          view.dispatch({
            changes: [
              { from: open.from, to: open.to + 1 },
              { from: close.from, to: Math.min(close.to + 1, state.doc.length) },
            ],
            selection: { anchor: open.from },
            scrollIntoView: true,
          });
          view.focus();
          return;
        }
      }
    }
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
  // 注册到右键菜单:编辑器内的右键文本操作直接作用于 CodeMirror 选区
  registerCmView(host.value!, view);
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
  if (host.value) unregisterCmView(host.value);
  view?.destroy();
  view = null;
});

defineExpose({
  scroller: () => view?.scrollDOM ?? null,
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-surface">
    <!-- 格式工具栏:按钮溢出时自动换行,不出现横向滚动条 -->
    <div class="flex shrink-0 flex-wrap content-start items-center gap-0.5 border-b border-line px-2 py-[5px]">
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
