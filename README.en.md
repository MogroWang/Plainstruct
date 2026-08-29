<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/logo-full-dark.svg">
    <img src="public/logo-full.svg" alt="Plainstruct" width="420">
  </picture>
</p>

# Plainstruct

A local-first static wiki site creator. Write Markdown in folders, build with one click, preview locally, and publish to GitHub Pages - no terminal, no backend.

[中文](./README.md) · [Changelog](./changelog.md)

## Features

- **Content management** - tree management of folders and Markdown documents: create (with custom title) / rename / move (drag & drop) / delete (to system trash) / import; multi-select via Shift range and Ctrl/⌘ toggle, batch move by drag & drop, folders auto-expand on hover; drag & drop shows an insertion indicator (row edge = move next to that row's directory, folder middle = move into the folder); dedicated right-click menus for the file tree (new / import / rename / delete) and the editor & inputs (cut / copy / paste / select all)
- **Live editing** - CodeMirror 6 editor side-by-side with rendered preview, proportional scroll sync, autosave; a formatting toolbar for headings, bold, italic, strikethrough, quote, lists, link, image, table and code blocks, with keyboard shortcuts and automatic list continuation; the preview shares the exact rendering pipeline with the build - what you see is what you ship
- **Site settings** - name, description and logo
- **One-click build** - output is plain static HTML; every internal link and asset is **relative**, so the site works on GitHub Pages project subpaths, custom domains, or opened from disk; folders without an index.md automatically get a generated directory listing page; a full link check runs at build time and broken links are listed in the report; the standalone preview window remembers its position & size and reloads in place on rebuild
- **Theme system** - built-in light & dark themes, mobile-friendly (document list collapses into a drawer with a top bar showing the site logo, name and description), optional "Created with Plainstruct" footer credit; visual settings panel (color / number / select / toggle); theme editor with code editing and live preview; themes import & export as ZIP
- **GitHub Pages publishing** - pushes the build as a **single atomic commit** via the GitHub API using a personal access token; creates repo / branch / Pages automatically - no Git required
- **Update check** - one-click check in Settings against the latest GitHub Release, showing the new version, release notes and publish time
- **Local-first** - all data lives inside the folder you choose; backup = copy; no backend, no telemetry
- **Bilingual UI** - switch between Chinese and English from the title bar

## Design

Plain (素) structure (构): gray-white palette, a single ink accent, system font stack, 4px base grid, 8px radius, one easing curve `cubic-bezier(0.23, 1, 0.32, 1)`. No gradients, no glows, no decoration for its own sake - hierarchy comes from type size, weight and whitespace.

## Getting Started

### Users

Unzip `release/Plainstruct-x64-portable.zip` (Windows x64 portable build) and run `plainstruct.exe`.

First run:

1. "New site" - pick a name and an empty folder
2. Create documents in the tree and start writing (documents declare title & order with a `---` front-matter block)
3. Build on the Build page and preview the final site
4. Pick or customize a theme on the Theme page
5. Fill in your GitHub username / repo / token on the Publish page and publish

### Access token

Create one at [GitHub Settings -> Developer settings -> Personal access tokens](https://github.com/settings/tokens) with the `repo` scope. The token is stored only in your site folder at `.plainstruct/github.json` and never uploaded anywhere; avoid shared computers.

## Site folder layout

```
<your site>/
├── content/            # documents & assets (editable with any tool)
│   ├── index.md        # site home
│   └── guide/
│       ├── index.md    # folder landing page (nav folder title comes from its front-matter title)
│       └── setup.md
├── .plainstruct/       # Plainstruct metadata
│   ├── site.json       # site config (name/description/logo/theme)
│   ├── github.json     # publish config (contains the token - keep private)
│   └── themes/         # custom themes
└── build/              # build output (safe to delete & rebuild)
```

**Path mapping**: `index.md -> index.html`, `foo.md -> foo.html`, `foo/index.md -> foo/index.html`. Link between documents with plain relative `.md` paths - they are rewritten to `.html` at build time. Folders without an `index.md` get an auto-generated directory listing page (`<folder>/index.html`) at build time, listing all documents and subfolders; folder titles in the navigation and directory pages are clickable links.

**Front-matter** fields: `title`, `order` (ascending), `description`.

## Theme development

A theme is a ZIP package:

```
theme.zip
├── theme.json          # metadata + settings-panel schema (required)
├── templates/
│   ├── layout.hbs      # full page layout (required)
│   └── page.hbs        # content area template (optional; defaults to raw content)
├── partials/           # Handlebars partials, registered by filename (optional)
└── assets/             # styles/scripts, referenced via {{asset}}
```

### theme.json

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "version": "1.0.0",
  "author": "you",
  "description": "A theme",
  "config": [
    { "key": "accentColor", "label": "Accent", "type": "color", "default": "#333333" },
    { "key": "sidebarWidth", "label": "Sidebar width", "type": "number", "default": 260, "min": 200, "max": 360, "step": 10 },
    { "key": "bodyFont", "label": "Body font", "type": "select", "default": "system", "options": ["system", "serif"] },
    { "key": "showDescription", "label": "Show description", "type": "boolean", "default": true }
  ]
}
```

Field types: `color` / `text` / `number` / `select` / `boolean`. The `config` array drives the visual settings panel automatically.

### Template context

Available in `layout.hbs` and `page.hbs`:

```handlebars
{{site.name}} {{site.description}} {{site.logo}}      {{!-- site info; logo is a page-relative URL --}}
{{page.title}} {{page.description}}                    {{!-- current document --}}
{{{page.content}}}                                      {{!-- triple braces: rendered HTML --}}
{{page.url}} {{page.relPrefix}}                        {{!-- output path / relative-root prefix --}}
{{#each nav}} {{this.title}} {{this.url}} {{this.current}} {{this.children}} {{/each}}
{{prev.title}} {{prev.url}} {{next.title}} {{next.url}}
{{config.accentColor}}                                  {{!-- theme settings values --}}
{{asset "style.css"}}                                   {{!-- asset URL, made relative per page depth --}}
```

Built-in helpers: `asset`, `eq`. Files under `partials/*.hbs` are registered by filename (`partials/nav.hbs` -> `{{> nav}}`); recursive partials are supported.

On the Theme page you can duplicate a built-in theme, edit templates & styles with live preview, and export a ZIP to share; others simply import the ZIP.

## Development

Requirements: Node 20+, Rust (MSVC toolchain), and on Windows [VS Build Tools](https://visualstudio.microsoft.com/downloads/) with the C++ workload.

```bash
npm install          # frontend deps
npm run dev          # browser-only dev (built-in mock site, no Rust needed)
npm run tauri dev    # full desktop app dev
npm run check        # vue-tsc type check
npm run build        # type check + production frontend build
cargo check          # Rust compile check (in src-tauri/)

npm run icons                          # generate app icons from icon.png
npm run windows:portable               # Windows x64 portable build -> release/Plainstruct-x64-portable.zip
npm run tauri -- build                 # platform installers (NSIS / dmg)
```

### Architecture

- **Frontend**: Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS 4 (custom Plainstruct tokens); CodeMirror 6 editor; markdown-it + highlight.js rendering; Handlebars templates
- **Desktop**: Tauri 2 (Rust). File IO, ZIP handling and the GitHub API live in Rust commands; a `site://` custom protocol serves the site folder directly so the build preview matches the published output exactly
- **No backend**: app state lives in the system app-data directory; site data lives entirely in the site folder

## Credits

Plainstruct by MogroWang Studio. The theme template interface and ZIP format are free for third-party extensions.
