/** 软件主题清单 -- 配色预览与深浅判定共用,色值与 tokens.css 中各 data-theme 变量保持一致 */
import type { AppTheme } from "@/ipc/types";

export interface AppThemeSwatch {
  /** 页面背景 */
  bg: string;
  /** 侧栏/面板底色 */
  panel: string;
  /** 分隔线 */
  line: string;
  /** 正文墨色 */
  text: string;
  /** 强调色(实底按钮) */
  accent: string;
}

export interface AppThemeDef {
  id: AppTheme;
  /** 深色主题(isDark 判定与深色 Logo 选择用) */
  dark: boolean;
  /** 主题名称的 i18n key */
  labelKey: string;
  /** 配色预览色板 */
  swatch: AppThemeSwatch;
  /** 跟随系统:预览呈浅色/深色对半 */
  dual?: boolean;
}

export const APP_THEMES: AppThemeDef[] = [
  {
    id: "system",
    dark: false,
    labelKey: "settings.themeSystem",
    dual: true,
    swatch: { bg: "#fafaf9", panel: "#efedec", line: "#e7e5e4", text: "#1c1917", accent: "#333333" },
  },
  {
    id: "light",
    dark: false,
    labelKey: "settings.themeLight",
    swatch: { bg: "#fafaf9", panel: "#efedec", line: "#e7e5e4", text: "#1c1917", accent: "#333333" },
  },
  {
    id: "dark",
    dark: true,
    labelKey: "settings.themeDark",
    swatch: { bg: "#171514", panel: "#2d2a27", line: "#34302c", text: "#e7e5e4", accent: "#e7e5e4" },
  },
  {
    id: "sepia",
    dark: false,
    labelKey: "settings.themeSepia",
    swatch: { bg: "#f7f2e9", panel: "#e9e0cd", line: "#ded3bd", text: "#40362a", accent: "#6b5537" },
  },
  {
    id: "mint",
    dark: false,
    labelKey: "settings.themeMint",
    swatch: { bg: "#f3f7f4", panel: "#dfe8e0", line: "#d2ded4", text: "#1b2a22", accent: "#2e6b4f" },
  },
  {
    id: "ocean",
    dark: true,
    labelKey: "settings.themeOcean",
    swatch: { bg: "#10161d", panel: "#222d3b", line: "#293645", text: "#d9e3ee", accent: "#d9e3ee" },
  },
  {
    id: "plum",
    dark: true,
    labelKey: "settings.themePlum",
    swatch: { bg: "#171217", panel: "#2f242e", line: "#372b36", text: "#ebe0e9", accent: "#ebe0e9" },
  },
];

export function appThemeDef(id: AppTheme): AppThemeDef {
  return APP_THEMES.find((t) => t.id === id) ?? APP_THEMES[1];
}
