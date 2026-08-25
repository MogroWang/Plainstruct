/** 构建管线 -- 读树 -> 渲染 Markdown -> 套主题 -> 写出 build/;
 *  renderPreview 与构建共用同一套解析,保证「预览即产出」。 */
import { ipc } from "@/ipc/ipc";
import type { BuildReport, BuildWarning, CopyItem, OutputFile, Platform, SiteConfig, TreeNode } from "@/ipc/types";
import { parseFrontMatter } from "./frontmatter";
import { renderMarkdown, type MdEnv } from "./markdown";
import { basename, dirname, encodePath, isMarkdown, mdToHtml, relPosix, relPrefix, stripExt } from "./paths";
import { compileTheme, mergeConfigDefaults, type NavItem, type PageContext, type ThemeBundle } from "./theme-engine";
import { siteUrl } from "./preview";

export interface DocMeta {
  path: string;
  title: string;
  order: number;
  description?: string;
  body: string;
}

interface RawNav {
  title: string;
  htmlPath?: string;
  children: RawNav[];
}

export type DocsCache = Record<string, string>;

function walkTree(nodes: TreeNode[], fn: (node: TreeNode) => void) {
  for (const n of nodes) {
    fn(n);
    if (n.children?.length) walkTree(n.children, fn);
  }
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** 收集全部 md 文档路径(content/ 相对) */
export function collectDocPaths(tree: TreeNode[]): string[] {
  const paths: string[] = [];
  walkTree(tree, (n) => {
    if (n.type === "file" && isMarkdown(n.path)) paths.push(n.path);
  });
  return paths;
}

/** 正文与 front-matter 标题重复时去掉正文首个标题,避免页面出现双标题 */
function stripLeadingTitle(body: string, title: string): string {
  const m = body.match(/^#\s+(.+?)\s*$/m);
  if (!m) return body;
  const norm = (s: string) => s.trim().replace(/\s+/g, " ");
  if (norm(m[1]) === norm(title)) {
    return body.replace(/^#\s+.+?\s*$/m, "").replace(/^\s+/, "");
  }
  return body;
}

function buildMetas(paths: string[], cache: DocsCache): Map<string, DocMeta> {
  const metas = new Map<string, DocMeta>();
  for (const path of paths) {
    const { data, body } = parseFrontMatter(cache[path] ?? "");
    const title = data.title ?? stripExt(basename(path));
    metas.set(path, {
      path,
      title,
      order: data.order ?? 0,
      description: data.description,
      body: stripLeadingTitle(body, title),
    });
  }
  return metas;
}

function buildNav(nodes: TreeNode[], metas: Map<string, DocMeta>): RawNav[] {
  const dirs: { item: RawNav; order: number }[] = [];
  const files: { item: RawNav; order: number }[] = [];
  for (const node of nodes) {
    if (node.type === "dir") {
      const indexChild = (node.children ?? []).find(
        (c) => c.type === "file" && c.name.toLowerCase() === "index.md",
      );
      const children = buildNav(
        (node.children ?? []).filter((c) => c !== indexChild),
        metas,
      );
      const indexMeta = indexChild ? metas.get(indexChild.path) : undefined;
      dirs.push({
        item: {
          title: indexMeta?.title ?? node.name,
          htmlPath: indexChild ? mdToHtml(indexChild.path) : undefined,
          children,
        },
        order: indexMeta?.order ?? 0,
      });
    } else if (isMarkdown(node.path)) {
      const meta = metas.get(node.path);
      files.push({
        item: {
          title: meta?.title ?? stripExt(node.name),
          htmlPath: mdToHtml(node.path),
          children: [],
        },
        order: meta?.order ?? 0,
      });
    }
  }
  const cmp = (a: { item: RawNav; order: number }, b: { item: RawNav; order: number }) =>
    a.order - b.order || naturalCompare(a.item.title, b.item.title);
  dirs.sort(cmp);
  files.sort(cmp);
  return [...dirs, ...files].map((d) => d.item);
}

function navForPage(raw: RawNav[], currentHtml: string, outDir: string): NavItem[] {
  return raw.map((item) => ({
    title: item.title,
    url: item.htmlPath ? encodePath(relPosix(outDir, item.htmlPath)) : undefined,
    current: item.htmlPath === currentHtml,
    children: item.children.length ? navForPage(item.children, currentHtml, outDir) : undefined,
  }));
}

function flattenNav(raw: RawNav[]): RawNav[] {
  const out: RawNav[] = [];
  for (const item of raw) {
    if (item.htmlPath) out.push(item);
    out.push(...flattenNav(item.children));
  }
  return out;
}

/** 渲染单页(构建与预览共用)。warnings 为空数组时收集,预览可忽略。 */
function renderOnePage(
  site: SiteConfig,
  config: Record<string, string | number | boolean>,
  render: ReturnType<typeof compileTheme>,
  navRaw: RawNav[],
  docMap: Map<string, string>,
  dirSet: Set<string>,
  doc: DocMeta,
  warnings: BuildWarning[],
  resolveAsset?: MdEnv["resolveAsset"],
  /** 预览模式:logo 的绝对地址(构建时留空,使用相对路径) */
  logoUrl?: string,
): PageContext & { html: string } {
  const env: MdEnv = { currentMdPath: doc.path, docMap, dirSet, warnings, resolveAsset };
  const content = renderMarkdown(doc.body, env);
  const htmlPath = mdToHtml(doc.path);
  const outDir = dirname(htmlPath);
  const prefix = relPrefix(htmlPath);
  const flat = flattenNav(navRaw);
  const idx = flat.findIndex((n) => n.htmlPath === htmlPath);
  const prev = idx > 0 ? flat[idx - 1] : undefined;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : undefined;

  const ctx: PageContext = {
    site: {
      name: site.name,
      description: site.description,
      logo: logoUrl ?? (site.logo ? prefix + "assets/" + encodePath(site.logo) : undefined),
    },
    page: {
      title: doc.title,
      description: doc.description,
      content,
      path: doc.path,
      url: htmlPath,
      relPrefix: prefix,
    },
    nav: navForPage(navRaw, htmlPath, outDir),
    prev: prev ? { title: prev.title, url: encodePath(relPosix(outDir, prev.htmlPath!)) } : undefined,
    next: next ? { title: next.title, url: encodePath(relPosix(outDir, next.htmlPath!)) } : undefined,
    config,
  };
  return { ...ctx, html: render(ctx) };
}

/**
 * 预览专用:把主题的 link/script 资源内联进 HTML。
 * 预览 iframe 以 document.write 写入,相对资源地址会指向应用自身 origin,必须内联。
 */
function inlineThemeAssets(html: string, files: Record<string, string>): string {
  return html
    .replace(/<link\b[^>]*href="([^"]+)"[^>]*>/gi, (m, href: string) => {
      const content = files["assets/" + href.replace(/^(\.\.\/)+/, "")];
      return content !== undefined ? `<style>\n${content}\n</style>` : m;
    })
    .replace(/<script\b[^>]*src="([^"]+)"[^>]*>\s*<\/script>/gi, (m, src: string) => {
      const content = files["assets/" + src.replace(/^(\.\.\/)+/, "")];
      return content !== undefined ? `<script>\n${content}\n</script>` : m;
    });
}

/** 单页预览:完整布局渲染当前文档(编辑器内容即时覆盖) */
export function renderPreview(
  site: SiteConfig,
  theme: ThemeBundle,
  tree: TreeNode[],
  cache: DocsCache,
  currentPath: string,
  currentBody: string | undefined,
  platform: Platform,
): string {
  const paths = collectDocPaths(tree);
  const docCache = { ...cache };
  if (currentBody !== undefined) docCache[currentPath] = currentBody;
  const metas = buildMetas(paths, docCache);

  const docMap = new Map<string, string>();
  const dirSet = new Set<string>();
  walkTree(tree, (n) => {
    if (n.type === "dir") dirSet.add(n.path.toLowerCase());
  });
  for (const p of paths) docMap.set(p.toLowerCase(), p);

  const config = mergeConfigDefaults(theme.meta, site.theme.config);
  const render = compileTheme(theme);
  const navRaw = buildNav(tree, metas);
  const doc = metas.get(currentPath);
  if (!doc) return "";
  const logoUrl = site.logo
    ? siteUrl(platform, `.plainstruct/assets/${site.logo}`)
    : undefined;
  const { html } = renderOnePage(
    site,
    config,
    render,
    navRaw,
    docMap,
    dirSet,
    doc,
    [],
    (resolved) => siteUrl(platform, "content/" + resolved),
    logoUrl,
  );
  return inlineThemeAssets(html, theme.files);
}

export async function buildSite(site: SiteConfig, theme: ThemeBundle): Promise<BuildReport> {
  const t0 = performance.now();
  const tree = await ipc.listTree();

  const mdPaths: string[] = [];
  const assetCopies: CopyItem[] = [];
  const dirSet = new Set<string>();
  walkTree(tree, (node) => {
    if (node.type === "dir") dirSet.add(node.path.toLowerCase());
    else if (isMarkdown(node.path)) mdPaths.push(node.path);
    else assetCopies.push({ src: `content/${node.path}`, dest: node.path });
  });

  const contents = await ipc.readDocs(mdPaths);
  const cache: DocsCache = {};
  mdPaths.forEach((path, i) => (cache[path] = contents[i] ?? ""));

  const docMap = new Map<string, string>();
  const metas = buildMetas(mdPaths, cache);
  for (const p of mdPaths) docMap.set(p.toLowerCase(), p);

  const config = mergeConfigDefaults(theme.meta, site.theme.config);
  const render = compileTheme(theme);
  const navRaw = buildNav(tree, metas);
  const warnings: BuildWarning[] = [];
  const outputs: OutputFile[] = [];

  // 主题文本资源(css/js 等)落到 build 根
  for (const [path, content] of Object.entries(theme.files)) {
    if (path.startsWith("assets/")) outputs.push({ path, content });
  }

  // 站点 logo
  if (site.logo) {
    assetCopies.push({ src: `.plainstruct/assets/${site.logo}`, dest: `assets/${site.logo}` });
  }

  for (const doc of metas.values()) {
    const { html } = renderOnePage(
      site,
      config,
      render,
      navRaw,
      docMap,
      dirSet,
      doc,
      warnings,
    );
    outputs.push({ path: mdToHtml(doc.path), content: html });
  }

  await ipc.clearBuild();
  await ipc.writeBuildFiles(outputs);
  await ipc.copyPaths(assetCopies);

  return {
    pages: outputs.filter((o) => o.path.endsWith(".html")).length,
    assets: assetCopies.length,
    warnings,
    durationMs: Math.round(performance.now() - t0),
  };
}
