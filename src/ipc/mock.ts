/** 浏览器 mock -- 无 Tauri 环境时的内存虚拟文件系统,用于纯前端开发 */
import type {
  AppSettings,
  Bootstrap,
  CopyItem,
  GithubConfig,
  OutputFile,
  RecentSite,
  SiteConfig,
  SyncProgress,
  SyncResult,
  ThemeMeta,
  TreeNode,
  VerifyResult,
} from "./types";
import { getBuiltinTheme } from "@/themes/manifest";

const LS_SETTINGS = "plainstruct.settings";
const LS_RECENT = "plainstruct.recent";

export const DEMO_ROOT = "C:/Sites/Plainstruct 演示站点";

/** 绝对路径 -> 文件内容 */
const files = new Map<string, string>();
/** 自定义主题 id -> 文件表 */
const customThemes = new Map<string, Record<string, string>>();
let settings: AppSettings = { locale: "zh-CN", autosave: true };
let recent: RecentSite[] = [];
let currentRoot: string | null = null;
let siteCounter = 0;
let buildFiles = new Map<string, string>();

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function delay(ms = 40) {
  return new Promise((r) => setTimeout(r, ms));
}

function siteJsonPath(root: string) {
  return `${root}/.plainstruct/site.json`;
}

function readJson<T>(abs: string): T | null {
  const raw = files.get(abs);
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeConfig(root: string, cfg: SiteConfig) {
  files.set(siteJsonPath(root), JSON.stringify(cfg, null, 2));
}

function touchRecent(root: string, name: string) {
  const cfg = readJson<SiteConfig>(siteJsonPath(root));
  recent = [
    { name, path: root, openedAt: Date.now() },
    ...recent.filter((s) => s.path !== root),
  ].slice(0, 8);
  lsSet(LS_RECENT, recent);
  void cfg;
}

/* ---------------- 演示站点内容 ---------------- */

const demoDocs: Record<string, string> = {
  "index.md": `---
title: 首页
order: 0
---

# 欢迎使用素构

素构(Plainstruct)是一个本地运行的静态文档站点创建器:文件夹里写 Markdown,一键构建,发布到 GitHub Pages。

- 左侧文件树管理文件夹与文档
- 编辑与实时预览左右对照
- 构建产物使用相对链接,部署在任何路径都不会乱

## 从这里开始

- [快速开始](guide/quickstart.md)
- [Markdown 语法示例](guide/markdown.md)
- [关于素构](about.md)
`,
  "guide/quickstart.md": `---
title: 快速开始
order: 1
---

# 快速开始

三步建立你的第一个站点。

## 1. 新建文档

在左侧文件树中点击「新建文档」,输入名称即可开始写作。

## 2. 构建站点

切到「构建」页,点击构建。素构会把 Markdown 渲染为静态 HTML,并保持所有链接为相对路径。

## 3. 发布

在「发布」页填入 GitHub 用户名、仓库与访问令牌,即可推送整站。

> 提示:文档之间的链接直接写 \`.md\` 相对路径,构建时会自动转换为 \`.html\`。
`,
  "guide/markdown.md": `---
title: Markdown 语法示例
order: 2
---

# Markdown 语法示例

## 文本样式

**加粗**、*斜体*、~~删除线~~、\`行内代码\`,以及[站内链接](quickstart.md)与[外部链接](https://pages.github.com/)。

## 列表

- 无序列表一项
- 无序列表二项

1. 有序列表一项
2. 有序列表二项

- [ ] 任务:写文档
- [x] 任务:装素构

## 代码

\`\`\`ts
export function greet(name: string): string {
  return \`你好,\${name}\`;
}
\`\`\`

## 表格

| 功能 | 状态 |
| --- | --- |
| 文件管理 | 可用 |
| 实时预览 | 可用 |
| 主题系统 | 可用 |

## 引用

> 简单的结构,可靠的结果。
`,
  "about.md": `---
title: 关于素构
order: 9
---

# 关于素构

素构是一个门槛低、本地运行的静态文档站点创建器。

- 技术栈:Vue 3 + TypeScript + Tauri
- 全部数据保存在你选择的文件夹里
- 主题为 ZIP 包,可导入导出
`,
};

function seedDemo() {
  if (files.has(siteJsonPath(DEMO_ROOT))) return;
  writeConfig(DEMO_ROOT, {
    name: "演示站点",
    description: "素构自带的示例文档站",
    theme: { id: "plain-light", source: "builtin", config: {} },
  });
  for (const [rel, content] of Object.entries(demoDocs)) {
    files.set(`${DEMO_ROOT}/content/${rel}`, content);
  }
}

function ensureInit() {
  seedDemo();
  settings = lsGet<AppSettings>(LS_SETTINGS, { locale: "zh-CN", autosave: true });
  recent = lsGet<RecentSite[]>(LS_RECENT, [
    { name: "演示站点", path: DEMO_ROOT, openedAt: Date.now() },
  ]);
}

/* ---------------- 树 ---------------- */

function buildTree(root: string): TreeNode[] {
  const prefix = `${root}/content/`;
  const rels = [...files.keys()]
    .filter((p) => p.startsWith(prefix))
    .map((p) => p.slice(prefix.length))
    .sort();
  const dirSet = new Set<string>();
  for (const rel of rels) {
    const parts = rel.split("/");
    for (let i = 1; i < parts.length; i++) dirSet.add(parts.slice(0, i).join("/"));
  }
  const nodes: TreeNode[] = [];
  const dirNodes = new Map<string, TreeNode>();
  for (const dir of [...dirSet].sort()) {
    const parts = dir.split("/");
    const node: TreeNode = { name: parts[parts.length - 1], path: dir, type: "dir", children: [] };
    dirNodes.set(dir, node);
    const parentDir = parts.slice(0, -1).join("/");
    const parent = parentDir ? dirNodes.get(parentDir) : undefined;
    if (parent) parent.children!.push(node);
    else nodes.push(node);
  }
  for (const rel of rels) {
    const name = rel.split("/").pop()!;
    const node: TreeNode = { name, path: rel, type: "file" };
    const parts = rel.split("/");
    const parentDir = parts.slice(0, -1).join("/");
    const parent = parentDir ? dirNodes.get(parentDir) : undefined;
    if (parent) parent.children!.push(node);
    else nodes.push(node);
  }
  return nodes;
}

/* ---------------- 命令实现 ---------------- */

export const mock = {
  async getBootstrap(): Promise<Bootstrap> {
    ensureInit();
    await delay();
    return {
      version: "0.1.0",
      platform: "browser",
      appDataDir: "(browser)",
      settings,
      recentSites: recent,
    };
  },

  async saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    ensureInit();
    settings = { ...settings, ...patch };
    lsSet(LS_SETTINGS, settings);
    return settings;
  },

  async createSite(dir: string, name: string, description?: string): Promise<SiteConfig> {
    ensureInit();
    if ([...files.keys()].some((p) => p.startsWith(`${dir}/`)) || files.has(dir)) {
      throw new Error("occupied");
    }
    writeConfig(dir, {
      name,
      description,
      theme: { id: "plain-light", source: "builtin", config: {} },
    });
    files.set(
      `${dir}/content/index.md`,
      `---\ntitle: 首页\norder: 0\n---\n\n# ${name}\n\n从这里开始写作。\n`,
    );
    currentRoot = dir;
    touchRecent(dir, name);
    return readJson<SiteConfig>(siteJsonPath(dir))!;
  },

  async openSite(dir: string): Promise<SiteConfig> {
    ensureInit();
    const cfg = readJson<SiteConfig>(siteJsonPath(dir));
    if (!cfg) throw new Error("not-a-site");
    currentRoot = dir;
    touchRecent(dir, cfg.name);
    return cfg;
  },

  async closeSite(): Promise<void> {
    currentRoot = null;
  },

  async readSiteConfig(): Promise<SiteConfig> {
    return readJson<SiteConfig>(siteJsonPath(currentRoot!))!;
  },

  async saveSiteConfig(patch: Partial<SiteConfig>): Promise<SiteConfig> {
    const cfg = { ...readJson<SiteConfig>(siteJsonPath(currentRoot!))!, ...patch };
    writeConfig(currentRoot!, cfg);
    return cfg;
  },

  async setSiteLogo(_srcPath: string): Promise<string> {
    return "logo.png";
  },

  async removeSiteLogo(): Promise<void> {
    const cfg = readJson<SiteConfig>(siteJsonPath(currentRoot!))!;
    delete cfg.logo;
    writeConfig(currentRoot!, cfg);
  },

  async listTree(): Promise<TreeNode[]> {
    await delay();
    return buildTree(currentRoot!);
  },

  async readDocs(paths: string[]): Promise<string[]> {
    return paths.map((p) => files.get(`${currentRoot}/content/${p}`) ?? "");
  },

  async saveDoc(path: string, content: string): Promise<void> {
    files.set(`${currentRoot}/content/${path}`, content);
  },

  async createDoc(dir: string, name: string): Promise<string> {
    let rel = dir ? `${dir}/${name}.md` : `${name}.md`;
    let i = 2;
    while (files.has(`${currentRoot}/content/${rel}`)) {
      rel = dir ? `${dir}/${name}-${i}.md` : `${name}-${i}.md`;
      i++;
    }
    files.set(
      `${currentRoot}/content/${rel}`,
      `---\ntitle: ${name}\n---\n\n# ${name}\n\n正文。\n`,
    );
    return rel;
  },

  async createFolder(parent: string, name: string): Promise<string> {
    return parent ? `${parent}/${name}` : name;
  },

  async renameItem(path: string, newName: string): Promise<string> {
    const parts = path.split("/");
    const isDir = !parts[parts.length - 1].includes(".");
    const parent = parts.slice(0, -1).join("/");
    const newPath = parent ? `${parent}/${newName}` : newName;
    const prefix = `${currentRoot}/content/${path}`;
    for (const key of [...files.keys()]) {
      if (key === prefix || (isDir && key.startsWith(`${prefix}/`))) {
        const moved = key.replace(prefix, `${currentRoot}/content/${newPath}`);
        files.set(moved, files.get(key)!);
        files.delete(key);
      }
    }
    return newPath;
  },

  async moveItem(src: string, destDir: string): Promise<string> {
    const name = src.split("/").pop()!;
    const newPath = destDir ? `${destDir}/${name}` : name;
    const prefix = `${currentRoot}/content/${src}`;
    for (const key of [...files.keys()]) {
      if (key === prefix || key.startsWith(`${prefix}/`)) {
        const moved = key.replace(prefix, `${currentRoot}/content/${newPath}`);
        files.set(moved, files.get(key)!);
        files.delete(key);
      }
    }
    return newPath;
  },

  async deleteItem(path: string): Promise<void> {
    const prefix = `${currentRoot}/content/${path}`;
    for (const key of [...files.keys()]) {
      if (key === prefix || key.startsWith(`${prefix}/`)) files.delete(key);
    }
  },

  async importFiles(srcPaths: string[], _destDir: string): Promise<number> {
    for (const src of srcPaths) {
      const name = src.split(/[\\/]/).pop()!;
      files.set(`${currentRoot}/content/${name}`, `# ${name}\n\n(导入的文件)\n`);
    }
    return srcPaths.length;
  },

  async clearBuild(): Promise<void> {
    buildFiles = new Map();
  },

  async writeBuildFiles(out: OutputFile[]): Promise<void> {
    await delay(60);
    for (const f of out) buildFiles.set(f.path, f.content);
  },

  async copyPaths(_items: CopyItem[]): Promise<void> {},

  getBuildIndex(): string | null {
    return buildFiles.get("index.html") ?? null;
  },

  async listCustomThemes(): Promise<ThemeMeta[]> {
    const metas: ThemeMeta[] = [];
    for (const [id, themeFiles] of customThemes) {
      let meta: Record<string, unknown> = {};
      try {
        meta = JSON.parse(themeFiles["theme.json"] ?? "{}") as Record<string, unknown>;
      } catch {
        /* 忽略坏 JSON */
      }
      metas.push({
        id,
        name: String(meta.name ?? id),
        version: String(meta.version ?? "0.1.0"),
        author: meta.author ? String(meta.author) : undefined,
        description: meta.description ? String(meta.description) : undefined,
        config: (meta.config as ThemeMeta["config"]) ?? [],
        source: "custom",
      });
    }
    return metas;
  },

  async readThemeFiles(themeId: string): Promise<Record<string, string>> {
    return { ...(customThemes.get(themeId) ?? {}) };
  },

  async saveThemeFiles(themeId: string, themeFiles: Record<string, string>): Promise<void> {
    const existing = customThemes.get(themeId);
    if (existing) customThemes.set(themeId, { ...existing, ...themeFiles });
  },

  async createCustomTheme(name: string, base: Record<string, string>): Promise<ThemeMeta> {
    siteCounter++;
    const id = `custom-${siteCounter}`;
    const themeFiles = { ...base };
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(themeFiles["theme.json"] ?? "{}") as Record<string, unknown>;
    } catch {
      /* 忽略 */
    }
    meta.id = id;
    meta.name = name;
    themeFiles["theme.json"] = JSON.stringify(meta, null, 2);
    customThemes.set(id, themeFiles);
    return {
      id,
      name,
      version: String(meta.version ?? "0.1.0"),
      author: meta.author ? String(meta.author) : undefined,
      description: meta.description ? String(meta.description) : undefined,
      config: (meta.config as ThemeMeta["config"]) ?? [],
      source: "custom",
    };
  },

  async deleteTheme(themeId: string): Promise<void> {
    customThemes.delete(themeId);
  },

  async importThemeZip(_zipPath: string): Promise<ThemeMeta> {
    // mock 无法解压真实 zip:复制内置浅色主题作为导入结果
    const base = getBuiltinTheme("plain-light");
    siteCounter++;
    const name = `导入主题 ${siteCounter}`;
    if (base) {
      return this.createCustomTheme(name, { ...base.files });
    }
    return {
      id: `imported-${siteCounter}`,
      name,
      version: "1.0.0",
      author: "Unknown",
      description: "",
      config: [],
      source: "custom",
    };
  },

  async exportThemeZip(_files: Record<string, string>, _destPath: string): Promise<void> {
    await delay(200);
  },

  async githubReadConfig(): Promise<GithubConfig> {
    return lsGet<GithubConfig>("plainstruct.github", {
      owner: "",
      repo: "",
      branch: "gh-pages",
      token: "",
      autoCreate: true,
    });
  },

  async githubSaveConfig(cfg: GithubConfig): Promise<void> {
    lsSet("plainstruct.github", cfg);
  },

  async githubVerify(cfg: GithubConfig): Promise<VerifyResult> {
    await delay(600);
    if (!cfg.token.startsWith("ghp_") && !cfg.token.startsWith("github_pat_")) {
      return { ok: false, message: "invalid-token" };
    }
    return { ok: true, user: cfg.owner || "you", repoExists: true, pagesEnabled: true };
  },

  async githubSync(
    cfg: GithubConfig,
    onProgress: (p: SyncProgress) => void,
  ): Promise<SyncResult> {
    const total = 12;
    for (let i = 1; i <= total; i++) {
      await delay(120);
      onProgress({ done: i, total, message: `upload ${i}/${total}` });
    }
    return {
      commitSha: "a1b2c3d4e5f6",
      pagesUrl: `https://${cfg.owner}.github.io/${cfg.repo}/`,
    };
  },

  async openPath(_path: string): Promise<void> {},

  async openExternal(_url: string): Promise<void> {
    window.open(_url, "_blank");
  },

  async logFrontend(_msg: string): Promise<void> {},
};

/** mock 模式下的文件选择:返回虚拟路径 */
export function mockPickDirectory(): string {
  siteCounter++;
  return `C:/Sites/新站点 ${siteCounter}`;
}

export function mockPickZip(): string {
  siteCounter++;
  return `C:/Downloads/theme-${siteCounter}.zip`;
}

export function mockPickImage(): string {
  return "C:/Pictures/logo.png";
}
