/** 内置主题清单 -- Vite ?raw 加载,与自定义主题(ZIP)同一结构 */
import type { ThemeBundle } from "@/lib/theme-engine";
import type { ThemeMeta } from "@/ipc/types";
import lightMeta from "./plain-light/theme.json";
import lightLayout from "./plain-light/templates/layout.hbs?raw";
import lightPage from "./plain-light/templates/page.hbs?raw";
import lightNav from "./plain-light/partials/nav.hbs?raw";
import lightCss from "./plain-light/assets/style.css?raw";
import darkMeta from "./plain-dark/theme.json";
import darkLayout from "./plain-dark/templates/layout.hbs?raw";
import darkPage from "./plain-dark/templates/page.hbs?raw";
import darkNav from "./plain-dark/partials/nav.hbs?raw";
import darkCss from "./plain-dark/assets/style.css?raw";
import inkMeta from "./ink/theme.json";
import inkLayout from "./ink/templates/layout.hbs?raw";
import inkPage from "./ink/templates/page.hbs?raw";
import inkNav from "./ink/partials/nav.hbs?raw";
import inkCss from "./ink/assets/style.css?raw";
import terminalMeta from "./terminal/theme.json";
import terminalLayout from "./terminal/templates/layout.hbs?raw";
import terminalPage from "./terminal/templates/page.hbs?raw";
import terminalNav from "./terminal/partials/nav.hbs?raw";
import terminalCss from "./terminal/assets/style.css?raw";
import galleryMeta from "./gallery/theme.json";
import galleryLayout from "./gallery/templates/layout.hbs?raw";
import galleryPage from "./gallery/templates/page.hbs?raw";
import galleryNav from "./gallery/partials/nav.hbs?raw";
import galleryCss from "./gallery/assets/style.css?raw";

export const builtinThemes: ThemeBundle[] = [
  {
    meta: { ...(lightMeta as unknown as ThemeMeta), source: "builtin" },
    files: {
      "theme.json": JSON.stringify(lightMeta, null, 2),
      "templates/layout.hbs": lightLayout,
      "templates/page.hbs": lightPage,
      "partials/nav.hbs": lightNav,
      "assets/style.css": lightCss,
    },
  },
  {
    meta: { ...(darkMeta as unknown as ThemeMeta), source: "builtin" },
    files: {
      "theme.json": JSON.stringify(darkMeta, null, 2),
      "templates/layout.hbs": darkLayout,
      "templates/page.hbs": darkPage,
      "partials/nav.hbs": darkNav,
      "assets/style.css": darkCss,
    },
  },
  {
    meta: { ...(inkMeta as unknown as ThemeMeta), source: "builtin" },
    files: {
      "theme.json": JSON.stringify(inkMeta, null, 2),
      "templates/layout.hbs": inkLayout,
      "templates/page.hbs": inkPage,
      "partials/nav.hbs": inkNav,
      "assets/style.css": inkCss,
    },
  },
  {
    meta: { ...(terminalMeta as unknown as ThemeMeta), source: "builtin" },
    files: {
      "theme.json": JSON.stringify(terminalMeta, null, 2),
      "templates/layout.hbs": terminalLayout,
      "templates/page.hbs": terminalPage,
      "partials/nav.hbs": terminalNav,
      "assets/style.css": terminalCss,
    },
  },
  {
    meta: { ...(galleryMeta as unknown as ThemeMeta), source: "builtin" },
    files: {
      "theme.json": JSON.stringify(galleryMeta, null, 2),
      "templates/layout.hbs": galleryLayout,
      "templates/page.hbs": galleryPage,
      "partials/nav.hbs": galleryNav,
      "assets/style.css": galleryCss,
    },
  },
];

export function getBuiltinTheme(id: string): ThemeBundle | undefined {
  return builtinThemes.find((t) => t.meta.id === id);
}
