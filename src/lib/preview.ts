/** 站点预览 URL -- site:// 自定义协议的平台差异封装 */
import type { Platform } from "@/ipc/types";

/** Windows WebView2 将自定义协议映射为 http://site.localhost/,macOS 为 site://localhost/ */
export function protocolBase(platform: Platform): string {
  return platform === "macos" ? "site://localhost/" : "http://site.localhost/";
}

/** 站点根内相对路径 -> 可访问 URL(用于构建预览与编辑器预览里的资源) */
export function siteUrl(platform: Platform, relPath: string): string {
  return (
    protocolBase(platform) +
    relPath
      .split("/")
      .filter(Boolean)
      .map((s) => encodeURIComponent(s))
      .join("/")
  );
}

/** 构建产物入口页 */
export function buildIndexUrl(platform: Platform): string {
  return siteUrl(platform, "build/index.html");
}
