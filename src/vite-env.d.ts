/// <reference types="vite/client" />

/** 应用版本,vite.config.ts define 注入(来源 package.json) */
declare const __APP_VERSION__: string;

declare module "*?raw" {
  const content: string;
  export default content;
}
