# 素构 Plainstruct

本地运行的静态文档(wiki)网站创建器。在文件夹里写 Markdown,一键构建、本地预览、发布到 GitHub Pages——不需要命令行,不需要后端。

[English](./README.en.md)

## 特性

- **内容管理** —— 文件夹与 Markdown 文档的树形管理,新建/重命名/移动(拖拽)/删除(进回收站)/导入
- **编辑与实时预览** —— CodeMirror 6 编辑器与渲染预览左右对照,比例滚动同步,自动保存;预览与构建共用同一渲染管线,所见即所得
- **站点管理** —— 站点名称、描述、Logo 均可配置
- **一键构建** —— 产物为纯静态 HTML;所有站内链接与资源使用**相对路径**,部署到 GitHub Pages 仓库子路径、自定义域名或本地直接打开都不会乱;构建时全量链接校验,失效链接在报告中列出
- **主题系统** —— 内置浅色/暗色两套主题;可视化配置面板(颜色/字号/选项/开关);主题制作器(代码编辑 + 实时预览);主题以 ZIP 包导入导出
- **GitHub Pages 发布** —— 使用个人访问令牌,通过 GitHub API 把构建结果作为**单次原子提交**推送到仓库,自动创建仓库/分支/开启 Pages,无需安装 Git
- **本地优先** —— 所有数据保存在你选择的站点文件夹内,备份即复制;无后端、无遥测
- **中英双语界面** —— 标题栏一键切换

## 界面与设计

素即素净,构即结构:灰白主色、单一墨色强调、系统字体栈、4px 基准网格、8px 圆角、统一缓动 `cubic-bezier(0.23, 1, 0.32, 1)`。无渐变、无发光、无多余装饰,层级全部来自字号、字重与留白。

## 安装与使用

### 普通用户

从 `release/Plainstruct-x64-portable.zip` 解压即用(Windows x64 免安装版),双击 `plainstruct.exe`。

首次使用:

1. 「新建站点」—— 填写站点名称,选择一个空文件夹
2. 在左侧文件树新建文档,开始写作(文档用 `---` 包裹的 front-matter 声明标题与排序)
3. 「构建」页一键构建,即可实时预览最终站点
4. 「主题」页挑选或定制主题
5. 「发布」页填入 GitHub 用户名/仓库名/访问令牌,一键发布

### 访问令牌(Token)

在 [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) 创建,勾选 `repo` 权限即可。令牌仅保存在站点文件夹的 `.plainstruct/github.json` 中,不会上传到任何地方;请在私人设备上使用。

## 站点文件夹结构

```
<你的站点文件夹>/
├── content/            # 文档与资源(可随时用其他编辑器打开)
│   ├── index.md        # 站点首页
│   └── guide/
│       ├── index.md    # 目录落地页(导航里文件夹标题取自它的 title)
│       └── setup.md
├── .plainstruct/       # 素构配置
│   ├── site.json       # 站点配置(名称/描述/Logo/主题)
│   ├── github.json     # 发布配置(含令牌,注意保密)
│   └── themes/         # 自定义主题
└── build/              # 构建输出(可整删重建)
```

**路径映射规则**:`index.md → index.html`、`foo.md → foo.html`、`foo/index.md → foo/index.html`;文档间链接直接写 `.md` 相对路径,构建时自动改写为 `.html`。

**Front-matter** 支持三个字段:`title`(标题)、`order`(排序,小在前)、`description`(描述)。

## 主题开发

主题是一个 ZIP 包,结构如下:

```
theme.zip
├── theme.json          # 元数据与配置面板 schema(必填)
├── templates/
│   ├── layout.hbs      # 整页布局(必填)
│   └── page.hbs        # 正文区模板(可选,默认直接输出 content)
├── partials/           # Handlebars 局部模板,按文件名注册(可选)
└── assets/             # 样式/脚本等资源,经 {{asset}} 引用
```

### theme.json

```json
{
  "id": "my-theme",
  "name": "我的主题",
  "version": "1.0.0",
  "author": "you",
  "description": "主题说明",
  "config": [
    { "key": "accentColor", "label": "强调色", "type": "color", "default": "#333333" },
    { "key": "sidebarWidth", "label": "侧栏宽度", "type": "number", "default": 260, "min": 200, "max": 360, "step": 10 },
    { "key": "bodyFont", "label": "正文字体", "type": "select", "default": "system", "options": ["system", "serif"] },
    { "key": "showDescription", "label": "显示站点描述", "type": "boolean", "default": true }
  ]
}
```

字段类型:`color` / `text` / `number` / `select` / `boolean`。`config` 数组会自动生成可视化配置面板。

### 模板上下文(模板接口)

`layout.hbs` 与 `page.hbs` 内可用以下数据:

```handlebars
{{site.name}} {{site.description}} {{site.logo}}      {{!-- 站点信息,logo 为当前页相对地址 --}}
{{page.title}} {{page.description}}                    {{!-- 当前文档 --}}
{{{page.content}}}                                      {{!-- 三花括号:渲染后的 HTML --}}
{{page.url}} {{page.relPrefix}}                        {{!-- 输出路径 / 相对根前缀 --}}
{{#each nav}} {{this.title}} {{this.url}} {{this.current}} {{this.children}} {{/each}}
{{prev.title}} {{prev.url}} {{next.title}} {{next.url}}
{{config.accentColor}}                                  {{!-- 主题配置值 --}}
{{asset "style.css"}}                                   {{!-- 资源地址,自动按页面深度转相对路径 --}}
```

内置 helper:`asset`、`eq`;`partials/` 下的 `.hbs` 按文件名注册为局部模板(如 `partials/nav.hbs` → `{{> nav}}`),支持递归调用。

在「主题」页可以:复制内置主题为新主题 → 在制作器里编辑模板/样式并实时预览 → 导出 ZIP 分享;他人导入 ZIP 即可使用。

## 开发

环境要求:Node 20+、Rust(MSVC 工具链)、Windows 上需 [VS Build Tools](https://visualstudio.microsoft.com/downloads/)(C++ 工作负载)。

```bash
npm install          # 安装前端依赖
npm run dev          # 纯浏览器开发(内置 mock 演示站点,无需 Rust)
npm run tauri dev    # 完整桌面应用开发
npm run check        # vue-tsc 类型检查
npm run build        # 前端类型检查 + 生产构建
cargo check          # 在 src-tauri/ 下,Rust 编译检查

npm run icons                          # 由 icon.png 生成全套应用图标
npm run windows:portable               # Windows x64 免安装构建 -> release/Plainstruct-x64-portable.zip
npm run tauri -- build                 # 平台安装包(NSIS / dmg)
```

### 技术架构

- **前端**:Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS 4(自定义素构令牌);编辑器 CodeMirror 6;渲染 markdown-it + highlight.js;模板 Handlebars
- **桌面**:Tauri 2(Rust)。文件 IO、ZIP、GitHub API 在 Rust 命令层;`site://` 自定义协议直读站点文件夹,构建预览与发布产物完全一致
- **无后端**:应用状态存于系统应用数据目录,站点数据全部在站点文件夹内

## 目录结构

```
├── public/logo.svg        # 应用 Logo(64×64,#333)
├── scripts/               # 图标生成 / 免安装打包脚本
├── src/                   # 前端源码
│   ├── ipc/               # Tauri IPC 封装 + 浏览器 mock
│   ├── lib/               # 路径映射 / Markdown / 主题引擎 / 构建管线
│   ├── themes/            # 内置主题(plain-light / plain-dark)
│   ├── stores/  components/  views/  i18n/
└── src-tauri/             # Rust 桌面层(命令 / 协议 / GitHub 同步)
```

## 许可与署名

Plainstruct 素构 by MogroWang Studio。主题模板接口与 ZIP 格式可供第三方自由扩展。
