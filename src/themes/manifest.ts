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
];

export function getBuiltinTheme(id: string): ThemeBundle | undefined {
  return builtinThemes.find((t) => t.meta.id === id);
}
