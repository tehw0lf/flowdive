import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../App';

const CI_YAML = vi.hoisted(() => `
name: CI Pipeline
on:
  push:
    branches: [main]
  pull_request:
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lint
        run: npm run lint
  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - name: Run tests
        run: npm test
`);

vi.mock('../components/YamlLoader', () => ({
  YamlLoader: ({ onLoad }: { onLoad: (files: { name: string; content: string }[]) => void }) => (
    <button
      data-testid="load-btn"
      onClick={() => onLoad([{ name: 'ci-pipeline.yml', content: CI_YAML }])}
    >
      Load
    </button>
  ),
}));

// Framer Motion: skip animations
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: new Proxy({}, {
      get: () => ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => <div {...props}>{children}</div>,
    }),
  };
});

// React Flow: stub out entirely
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children: React.ReactNode }) => <div data-testid="react-flow">{children}</div>,
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  useReactFlow: () => ({ fitView: vi.fn() }),
  addEdge: vi.fn(),
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom' },
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  BackgroundVariant: { Dots: 'dots' },
}));

async function renderAndLoad() {
  render(<App />);
  await act(async () => {
    fireEvent.click(screen.getByTestId('load-btn'));
  });
  // Default view is graph (ReactFlow mocked, nodes not rendered) — switch to grid
  fireEvent.click(screen.getByTitle('Grid view'));
  return screen.findByText('CI Pipeline');
}

describe('Navigation', () => {
  it('loads a workflow and shows orchestrator level', async () => {
    await renderAndLoad();
    expect(screen.getByText('CI Pipeline')).toBeInTheDocument();
  });

  it('switches to grid view and shows card', async () => {
    await renderAndLoad();
    expect(screen.getByText('CI Pipeline')).toBeInTheDocument();
  });

  it('drills into jobs on drill button click', async () => {
    await renderAndLoad();
    fireEvent.click(screen.getByTitle('Drill into'));
    // 'lint' appears as job name AND as needs-pill value — check at least one exists
    await screen.findAllByText('lint');
    expect(screen.getAllByText('lint').length).toBeGreaterThan(0);
    expect(screen.getAllByText('test').length).toBeGreaterThan(0);
  });

  it('shows breadcrumb after drill', async () => {
    await renderAndLoad();
    fireEvent.click(screen.getByTitle('Drill into'));
    await screen.findAllByText('lint');
    expect(screen.getByText('CI Pipeline')).toBeInTheDocument();
  });

  it('navigates back to root via breadcrumb', async () => {
    await renderAndLoad();
    fireEvent.click(screen.getByTitle('Drill into'));
    await screen.findAllByText('lint');
    fireEvent.click(screen.getByText('ROOT'));
    await screen.findByText('CI Pipeline');
    expect(screen.getByText('CI Pipeline')).toBeInTheDocument();
  });

  it('drills into steps from job level', async () => {
    await renderAndLoad();
    fireEvent.click(screen.getByTitle('Drill into'));
    await screen.findAllByText('lint');
    const drillBtns = screen.getAllByTitle('Drill into');
    fireEvent.click(drillBtns[0]);
    await screen.findByText('Lint');
    expect(screen.getByText('Lint')).toBeInTheDocument();
  });
});
