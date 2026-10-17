# NEURAL CANVAS

A local-first interactive workspace for visual thinking, knowledge graphs, and project work.

## What works

- **Canvas:** pan, zoom, drag nodes, multi-select with Shift-drag or Ctrl/Cmd-click (or toggle selection mode for touch), move selected groups, and highlight connected nodes. Create nodes from the toolbar, by double-clicking blank space, or from a right-click context menu. Center or fit the graph, use the zoom controls and minimap, and connect only by dragging node handles—new nodes never gain an implicit link. Delete moves nodes to Trash and removes selected connections.
- **Inspector:** edit titles, descriptions, types, status, priority, tags, color, created/updated dates, and custom properties. Review incoming and outgoing links separately, choose a relation type and label when adding explicit connections, remove links, jump to related objects, toggle favorites, duplicate objects, or move them to Trash. The inspector has a clear no-selection state and can collapse; duplicates copy object details but never create implicit links.
- **Developer Workspace:** manage projects with status, tech stacks, repository/demo links, connected ideas, tasks, and architecture decisions. Track task status, criticality, deadlines, tags, projects, and graph relationships in List or draggable Kanban views; status changes persist to the shared graph. Architecture notes cover decisions, architecture explanations, API endpoints, docs, algorithms, code snippets, and study questions. Code remains text-only and copyable—never executed.
- **Notes:** write local Markdown with headings, formatting, lists, checklists, links, and fenced code; switch between writing and a safe preview, then explicitly connect notes to any graph node. Note content autosaves and participates in global search.
- **Workspace views:** a searchable knowledge library and focused project/task/notes views share the same graph data and local-first persistence.
- **Top navigation:** switch between and create local workspaces, rename the current space, open settings and shortcut help, and access a local profile menu. Save status follows actual persistence events: unsaved changes, saving, saved locally, or save error.
- **Left navigation:** open Overview, Canvas, Graph Intelligence, Knowledge Base, Projects, Tasks, Notes, Recent, Favorites, and Trash. Search and type/status filters narrow the active view; the sidebar can collapse on desktop.
- **Search and shortcuts:** substring-search nodes, projects, tasks, Markdown notes, architecture notes, tags, and descriptions; filter by type, see matching text highlighted, and open results in their inspector. `⌘/Ctrl + K` opens a keyboard-navigable command palette with create, search, fit, export, and settings actions. `N` captures a thought, `Esc` closes/clears search, and `Delete` moves a selected canvas node to Trash or removes a selected link.
- **Local persistence:** complete workspaces (graph nodes and links, projects/tasks, Markdown and architecture notes, favorites, and per-workspace settings) autosave to IndexedDB through Dexie schema version 2. The app shows saving/error state, flushes pending edits when the page is hidden, and migrates earlier records. Invalid saved records are preserved and surfaced rather than silently replaced with starter data. The default starting view is a persisted workspace setting.
- **Backups and transfer:** export produces a versioned `neural-canvas-workspace` JSON backup validated by Zod. Import validates the schema and graph references before writing, supports legacy unversioned files, and reports validation errors. Choose **Merge** to retain current records/settings and remap ID conflicts, **Replace** to overwrite only after checking an explicit confirmation (with an automatic local backup created first), or **Cancel** without changes.
- **Local connection hints:** a small transparent heuristic highlights two unlinked nodes with a shared tag. It does not call an AI service or require an account.
- **Graph Intelligence:** computes active-node in/out degree, direct neighbors, direction-aware shortest paths, breadth/depth traversal, weakly connected components, isolated nodes, normalized exact-title matches, and graph statistics from the real local graph. Large workspaces run analysis in a Web Worker; title matches are only possible duplicates, not evidence of semantic identity. Neighborhood, path, and traversal results can be highlighted on the canvas.
- **Optional AI contract:** `src/ai/AIProvider.ts` defines a replaceable provider interface for idea generation, node expansion, project/task breakdown, connection suggestions, knowledge summaries, study plans, question generation, contradiction analysis, tag suggestions, node creation from text, and structured import. No provider is registered by default: the UI says **“AI provider not configured.”** No AI results are generated. Cloud integrations must keep secrets server-side, obtain explicit per-request consent, send only relevant context, and return proposals for review.
- **Responsive UI:** desktop canvas with a mobile navigation drawer and touch-friendly graph controls. Graph Intelligence reflows for smaller screens and respects `prefers-reduced-motion`.
- **Design system:** `src/design-system.css` defines semantic CSS-variable tokens for surfaces, glass, borders, type, accents/status, spacing, radii, shadows, blur, and motion. Shared controls use consistent focus, hover, active, disabled, loading, and error treatments while preserving the quiet glass visual language.
- **Accessibility:** dialogs move focus on open, trap Tab/Shift+Tab, restore focus on close, and close with Escape; ARIA menus support arrow/Home/End navigation. Primary controls have accessible names, clear status text, and visible focus rings. Canvas node status and task priority are expressed in text as well as color.

## Graph data contract

Nodes use the required `id`, `type`, `title`, `description`, `tags`, `color`, `createdAt`, `updatedAt`, `position`, `favorite`, and `properties` fields (with the workspace's status and priority fields retained). Supported node types are `idea`, `concept`, `knowledge`, `project`, `task`, `note`, `resource`, `question`, `hypothesis`, and `decision`.

Connections require `id`, `sourceId`, `targetId`, `relationType`, `label`, and `createdAt`; optional metadata is an open JSON object. Supported relation types are `related_to`, `depends_on`, `part_of`, `implements`, `contradicts`, `supports`, `references`, `derived_from`, `blocks`, and `custom`. Canonical imports reject unknown node or relation types and endpoints that do not exist. `depends_on`, `part_of`, and `blocks` must remain acyclic; other relations may form cycles. Existing local data and exports using the previous `kind`/`customProperties` and `source`/`target` names are normalized during parsing; unrecognized legacy relation values become `custom`.

## Публикация на Vercel

1. В Vercel создайте проект из этого Git-репозитория и оставьте корневую папку проекта в корне репозитория.
2. Настройки уже заданы в `vercel.json`: установка через `npm ci`, сборка через `npm run build`, публикация папки `dist` и перенаправление адресов приложения на `index.html`.
3. Переменные окружения и API-ключи не нужны. Vercel собирает и размещает статический сайт; приложение не требует серверной функции.
4. После подключения репозитория нажмите **Deploy**. Последующие изменения в выбранной production-ветке будут публиковаться автоматически.

Важно: рабочие пространства хранятся в IndexedDB браузера на текущем устройстве, а не на Vercel. Они не синхронизируются между устройствами. Для переноса или резервной копии экспортируйте JSON-файл в настройках.

## Run locally

```sh
npm install
npm run dev
```

Vite binds to `0.0.0.0` for preview environments. No server, sign-in, API key, or network connection is required for workspace data or core features.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

The first open seeds a small sample workspace. Edits are stored locally in the browser on the current device. Export a JSON backup before clearing browser storage or moving to another device.
