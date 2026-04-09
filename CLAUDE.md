# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server (Vite)
npm run build        # TypeScript check + Vite build
npm run lint         # ESLint
npm run test         # Vitest (unit, run once)
npm run test:watch   # Vitest (watch mode)
npm run test:e2e     # Playwright (requires build first: npm run build && npm run preview)
```

Run a single test file:
```bash
npx vitest run src/test/parser.test.ts
```

Pre-commit validation:
```bash
npm run lint && npm run test && npm run build
```

## Architecture

**flowdive** is a single-page React app (Vite + TypeScript + Tailwind v4) that visualizes GitHub Actions workflows with drill-down navigation.

### Navigation model

There are four drill levels: `orchestrator → job → step` (or `orchestrator → job → workflow → job → step` when a job calls a reusable workflow). The active position is tracked in `DrillState` (types.ts) and synced to URL search params (`?level=...&orc=...&wf=...&job=...`).

- **orchestrator level**: Shows workflows that contain at least one `uses:` job (reusable workflow callers). If none exist, falls back to showing all workflows.
- **job level**: Shows jobs of the selected orchestrator or workflow.
- **step level**: Shows steps of the selected job.
- **workflow level** is only used in breadcrumbs when drilling through a `uses:`-referencing job into a reusable workflow.

### Key data flow

1. `YamlLoader` (file drop / GitHub API / paste) → calls `onLoad` with raw `{ name, content }[]`
2. `parseMultipleFiles` in `parser.ts` → produces `WorkflowData[]` + `OrchestratorData[]`
3. `App.tsx` holds all state: `workflows`, `drillState`, `breadcrumb`, `popup`
4. `currentItems()` derives the displayed card list from `drillState` on every render
5. Cards render in either `GraphView` (React Flow + dagre layout) or grid (`LevelCard`)

### Reusable workflow resolution

`resolveUsesRef` / `resolveUsesId` match a job's `uses:` string to a loaded `WorkflowData` by:
1. Exact `id` / `filename` match
2. Filename suffix match (handles `./.github/workflows/foo.yml` → `foo.yml`)

This is what makes drill-down from a `uses:`-job navigate into the called workflow instead of into steps.

### Component responsibilities

- `App.tsx` — all navigation logic (`drillInto`, `navigateTo`), state, URL sync
- `parser.ts` — pure YAML parsing; `resolveUsesRef` for cross-file linking
- `GraphView.tsx` — React Flow canvas; `buildGraph` constructs nodes/edges; dagre layout for graphs, grid layout for step/edge-free levels
- `LevelCard.tsx` — card rendering for grid mode; delegates pill rendering to `CardPills.tsx`
- `CardPills.tsx` — also exports `levelConfig` (colors/icons per level) used by both grid and graph nodes
- `CardPopup.tsx` — floating detail panel on card click
- `HudPanel.tsx` — left/right ambient info panels
- `YamlLoader.tsx` — file loading UI; also contains GitHub API fetch logic

### Testing

- Unit tests (Vitest + Testing Library): `src/test/` — covers parser, navigation, accessibility, CardPills, CardPopup, GraphView
- E2E tests (Playwright): `e2e/` — runs against `npm run preview` on port 4173
- Navigation tests stub out React Flow and Framer Motion to avoid canvas rendering issues; they switch to grid view before asserting on cards
