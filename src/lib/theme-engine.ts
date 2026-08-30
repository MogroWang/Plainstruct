/** 主题引擎 -- Handlebars 声明式模板,构建与预览共用 */
import Handlebars from "handlebars";
import type { ThemeMeta } from "@/ipc/types";
import { encodePath, relPrefix } from "./paths";

export interface ThemeBundle {
  meta: ThemeMeta;
  /** 路径 -> 文件内容,如 "templates/layout.hbs" */
  files: Record<string, string>;
}

export interface NavItem {
  title: string;
  url?: string;
  children?: NavItem[];
  current?: boolean;
}

export interface PageContext {
  site: { name: string; description?: string; logo?: string; locale?: string };
  page: {
    title: string;
    description?: string;
    content: string;
    path: string;
    url: string;
    relPrefix: string;
    /** 浏览器标签页标题(按站点 titleFormat 拼接) */
    fullTitle?: string;
    /** 当前页在导航中的面包屑(不含页面自身),移动端顶栏展示 */
    crumbs?: string[];
  };
  nav: NavItem[];
  prev?: { title: string; url: string };
  next?: { title: string; url: string };
  config: Record<string, string | number | boolean>;
}

/** 配置值与主题默认值合并(缺省字段用 default) */
export function mergeConfigDefaults(
  meta: ThemeMeta,
  values: Record<string, string | number | boolean> | undefined,
): Record<string, string | number | boolean> {
  const merged: Record<string, string | number | boolean> = {};
  for (const field of meta.config ?? []) {
    const v = values?.[field.key];
    merged[field.key] = v === undefined || v === null ? (field.default ?? "") : v;
  }
  return merged;
}

/** 校验主题完整性:必须包含 templates/layout.hbs */
export function validateTheme(bundle: ThemeBundle): string | null {
  if (!bundle.files["templates/layout.hbs"]) return "missing layout";
  if (!bundle.meta?.id) return "missing id";
  return null;
}

const FALLBACK_PAGE_PARTIAL = "{{{page.content}}}";

/** 编译一次,渲染多页。renderPage 内部按页注入 asset 相对路径。 */
export function compileTheme(bundle: ThemeBundle): (ctx: PageContext) => string {
  const hb = Handlebars.create();
  for (const [path, content] of Object.entries(bundle.files)) {
    if (path.startsWith("partials/") && path.endsWith(".hbs")) {
      const name = path.slice("partials/".length, -".hbs".length);
      hb.registerPartial(name, content);
    }
  }
  hb.registerPartial("page", bundle.files["templates/page.hbs"] ?? FALLBACK_PAGE_PARTIAL);
  hb.registerHelper("asset", (path: string, options: { data?: { root?: PageContext } }) => {
    const prefix = options?.data?.root?.page?.relPrefix ?? "";
    return encodePath(prefix + path);
  });
  hb.registerHelper("eq", (a: unknown, b: unknown) => a === b);

  const layout = hb.compile(bundle.files["templates/layout.hbs"], { noEscape: false });
  return (ctx: PageContext) =>
    layout({ ...ctx, page: { ...ctx.page, relPrefix: relPrefix(ctx.page.url) } });
}

/** 渲染主题预览图/示例页(与正式渲染同一路径) */
export function renderPage(theme: ThemeBundle, ctx: PageContext): string {
  return compileTheme(theme)(ctx);
}
