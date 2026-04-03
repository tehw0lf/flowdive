# flowdive

An interactive visualizer for GitHub Actions workflow YAML files. Explore your CI/CD pipelines in a card-based grid view or a dependency graph, drill down from workflow to job to step level, and inspect job details in-context.

## Features

- **Grid & Graph views** — toggle between a card grid and a DAG-based dependency graph powered by Dagre + React Flow
- **Drill-down navigation** — orchestrator → workflow → job → step with breadcrumb navigation
- **Job details popup** — click any card to see runs-on, environment, matrix dimensions, steps, and `workflow_dispatch` inputs
- **Dependency arrows** — `needs` edges rendered as pills on cards and as arrows in graph view
- **Environment & matrix pills** — environment names and matrix combination counts displayed inline on job cards
- **URL state** — drill level and selected IDs are persisted in the URL query string (shareable / browser-back-friendly)
- **Arrow key navigation** — navigate between cards with `←→↑↓` keys
- **Visual effects toggle** — particle background and 3D tilt effects can be disabled
- **Lazy-loaded graph view** — GraphView chunk only loaded when needed (~219 kB separate)
- **Keyboard accessible** — full ARIA roles, labels, and focus management

## Usage

1. Open the app and either drop a YAML file onto the loader, pick a file via the file dialog, or paste YAML directly into the text area.
2. Click **PARSE** (paste mode) or select a file to load the workflow.
3. Use **Grid** / **Graph** view buttons to switch visualizations.
4. Click the drill-down button on a card to navigate into that level.
5. Click any card to open its detail popup; press `Escape` or the close button to dismiss it.
6. Use the breadcrumb to jump back up the hierarchy.

## Development

```bash
npm install
npm run dev          # dev server at http://localhost:5173
npm run test         # unit tests (Vitest)
npm run test:watch   # unit tests in watch mode
npm run lint         # ESLint
npm run build        # production build (dist/)
npm run preview      # preview production build at http://localhost:4173
npm run test:e2e     # Playwright E2E tests (requires npm run preview or a running server)
```

## Tech Stack

| Concern | Library |
|---|---|
| UI framework | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| Graph layout | Dagre |
| Graph rendering | React Flow (`@xyflow/react`) |
| YAML parsing | js-yaml |
| Unit tests | Vitest + React Testing Library |
| E2E tests | Playwright (Chromium) |

## Project Structure

```
src/
  components/
    YamlLoader.tsx     # file drop / paste input
    LevelCard.tsx      # card with 3D tilt, drill-down and detail actions
    CardPills.tsx      # environment, matrix, needs, uses pills
    CardPopup.tsx      # detail popup (job steps, matrix, dispatch inputs)
    GraphView.tsx      # DAG graph view (lazy-loaded)
    Breadcrumb.tsx     # navigation breadcrumb
    HudPanel.tsx       # view mode / effects toggle toolbar
    ParticleBackground.tsx
    RippleTransition.tsx
  test/               # Vitest unit tests
  App.tsx             # root component, drill state, URL sync, keyboard nav
e2e/
  app.spec.ts         # Playwright E2E tests
```

## Supported YAML Features

- `name`, `on` triggers (including `workflow_dispatch` inputs)
- `jobs.<id>.runs-on`
- `jobs.<id>.needs` (single string or array)
- `jobs.<id>.environment` (string or `{ name, url }`)
- `jobs.<id>.strategy.matrix`
- `jobs.<id>.steps[].name`, `uses`, `run`
- `jobs.<id>.uses` (reusable workflow calls)
