/** 极简 front-matter:文件起始 --- 包围块,支持 title / order / description */

export interface FrontMatter {
  title?: string;
  order?: number;
  description?: string;
}

export interface ParsedDoc {
  data: FrontMatter;
  body: string;
}

const FENCE = /^---\r?\n/;
const FENCE_END = /^(---|\.\.\.)\s*$/;

export function parseFrontMatter(src: string): ParsedDoc {
  if (!FENCE.test(src)) return { data: {}, body: src };
  const rest = src.slice(src.indexOf("\n") + 1);
  const lines = rest.split(/\r?\n/);
  const data: FrontMatter = {};
  let end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE_END.test(lines[i])) {
      end = i;
      break;
    }
    const m = lines[i].match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (key === "title") data.title = value;
    else if (key === "order") {
      const n = Number(value);
      if (Number.isFinite(n)) data.order = n;
    } else if (key === "description") data.description = value;
  }
  // 结束围栏缺失时视为普通正文,不吞内容
  if (end === -1) return { data: {}, body: src };
  const body = lines.slice(end + 1).join("\n");
  return { data, body: body.replace(/^\r?\n/, "") };
}
