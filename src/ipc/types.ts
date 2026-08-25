/** 前后端共享的数据契约 -- 与 Rust 侧 serde 结构一一对应 */

export type Platform = "windows" | "macos" | "browser";
export type Locale = "zh-CN" | "en-US";
export type ThemeSource = "builtin" | "custom";

export interface AppSettings {
  locale: Locale;
  autosave: boolean;
}

export interface RecentSite {
  name: string;
  path: string;
  openedAt: number;
}

export interface Bootstrap {
  version: string;
  platform: Platform;
  appDataDir: string;
  settings: AppSettings;
  recentSites: RecentSite[];
}

export interface SiteThemeRef {
  id: string;
  source: ThemeSource;
  config: Record<string, string | number | boolean>;
}

export interface SiteConfig {
  name: string;
  description?: string;
  logo?: string; // .plainstruct/assets/ 内的文件名
  theme: SiteThemeRef;
}

export interface TreeNode {
  name: string;
  path: string; // 相对 content/,POSIX 风格,如 "guide/setup.md"
  type: "dir" | "file";
  children?: TreeNode[];
}

export type ThemeFieldType = "color" | "text" | "number" | "select" | "boolean";

export interface ThemeField {
  key: string;
  label: string;
  type: ThemeFieldType;
  default?: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface ThemeMeta {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  config: ThemeField[];
  source: ThemeSource;
}

export interface OutputFile {
  path: string; // 相对 build/,POSIX 风格
  content: string;
}

export interface CopyItem {
  src: string; // 相对站点根
  dest: string; // 相对站点根
}

export interface GithubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  autoCreate: boolean;
}

export interface VerifyResult {
  ok: boolean;
  user?: string;
  repoExists?: boolean;
  pagesEnabled?: boolean;
  message?: string;
}

export interface SyncResult {
  commitSha: string;
  pagesUrl: string;
}

export interface SyncProgress {
  done: number;
  total: number;
  message: string;
}

export interface BuildWarning {
  source: string; // 源文档路径
  link: string; // 原始链接
  message: string;
}

export interface BuildReport {
  pages: number;
  assets: number;
  warnings: BuildWarning[];
  durationMs: number;
}
