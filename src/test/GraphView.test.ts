import { describe, it, expect, vi } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { applyGridLayout, applyDagreLayout, resolveUsesId, buildGraph } from '../components/GraphView';
import type { WorkflowData, JobData, OrchestratorData } from '../types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@xyflow/react', () => ({
  ReactFlow: () => null,
  ReactFlowProvider: ({ children }: { children: unknown }) => children,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  useReactFlow: () => ({ fitView: vi.fn() }),
  addEdge: vi.fn(),
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom' },
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
}));

vi.mock('@dagrejs/dagre', () => {
  class MockGraph {
    private positions: Record<string, { x: number; y: number }> = {};
    private counter = 0;
    setDefaultEdgeLabel() {}
    setGraph() {}
    setNode(id: string) { this.positions[id] = { x: this.counter * 300, y: 0 }; this.counter++; }
    setEdge() {}
    node(id: string) { return this.positions[id] ?? { x: 0, y: 0 }; }
  }
  return {
    default: {
      graphlib: { Graph: MockGraph },
      layout: vi.fn(),
    },
  };
});

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    motion: new Proxy({}, {
      get: () => ({ children, ...props }: Record<string, unknown>) => ({ type: 'div', props: { ...props, children } }),
    }),
  };
});

vi.mock('../hooks/useTilt', () => ({
  useTilt: () => ({ ref: { current: null }, rotateX: 0, rotateY: 0, onMouseMove: vi.fn(), onMouseLeave: vi.fn() }),
}));

// ─── applyGridLayout ──────────────────────────────────────────────────────────

describe('applyGridLayout', () => {
  const makeNodes = (n: number): Node[] =>
    Array.from({ length: n }, (_, i) => ({ id: String(i), position: { x: 0, y: 0 }, data: {} }));

  it('places first node at 0,0', () => {
    const [first] = applyGridLayout(makeNodes(1));
    expect(first.position).toEqual({ x: 0, y: 0 });
  });

  it('places 4th node (index 3) on second row, first column', () => {
    const nodes = applyGridLayout(makeNodes(4));
    expect(nodes[3].position.x).toBe(0);
    expect(nodes[3].position.y).toBeGreaterThan(0);
  });

  it('wraps at 3 columns', () => {
    const nodes = applyGridLayout(makeNodes(4));
    // index 3 → row 1, col 0
    expect(nodes[3].position.x).toBe(nodes[0].position.x);
  });

  it('preserves node ids', () => {
    const nodes = applyGridLayout(makeNodes(3));
    expect(nodes.map(n => n.id)).toEqual(['0', '1', '2']);
  });
});

// ─── applyDagreLayout ─────────────────────────────────────────────────────────

describe('applyDagreLayout', () => {
  const makeNode = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: {} });
  const makeEdge = (source: string, target: string): Edge => ({ id: `${source}-${target}`, source, target, data: {} });

  it('returns same number of nodes', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const result = applyDagreLayout(nodes, [makeEdge('a', 'b')]);
    expect(result).toHaveLength(2);
  });

  it('preserves node ids', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const result = applyDagreLayout(nodes, []);
    expect(result.map(n => n.id)).toEqual(['a', 'b', 'c']);
  });
});

// ─── resolveUsesId ────────────────────────────────────────────────────────────

describe('resolveUsesId', () => {
  const wf = (id: string, filename: string): WorkflowData => ({
    id, filename, on: {}, jobs: {},
  });

  it('resolves by exact id', () => {
    const workflows = [wf('deploy.yml', 'deploy.yml')];
    expect(resolveUsesId('deploy.yml', workflows)).toBe('deploy.yml');
  });

  it('resolves by filename from path', () => {
    const workflows = [wf('deploy.yml', 'deploy.yml')];
    expect(resolveUsesId('./.github/workflows/deploy.yml', workflows)).toBe('deploy.yml');
  });

  it('strips @ref suffix before resolving', () => {
    const workflows = [wf('deploy.yml', 'deploy.yml')];
    expect(resolveUsesId('./.github/workflows/deploy.yml@main', workflows)).toBe('deploy.yml');
  });

  it('returns null for unresolvable external action', () => {
    const workflows = [wf('deploy.yml', 'deploy.yml')];
    expect(resolveUsesId('actions/checkout@v4', workflows)).toBeNull();
  });
});

// ─── buildGraph ───────────────────────────────────────────────────────────────

describe('buildGraph', () => {
  const onSelect = vi.fn();
  const onDrillDown = vi.fn();

  const job = (id: string, needs?: string[]): JobData => ({
    id, 'runs-on': 'ubuntu-latest', steps: [], needs,
  });

  const orc = (id: string, calls: string[]): OrchestratorData => ({
    id, filename: `${id}.yml`, triggers: ['push'],
    calledWorkflows: calls,
    workflow: { id, filename: `${id}.yml`, on: {}, jobs: {} },
  });

  it('creates one node per item', () => {
    const { nodes } = buildGraph([job('lint'), job('test')], 'job', [], null, false, onSelect, onDrillDown);
    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.id)).toEqual(['lint', 'test']);
  });

  it('creates needs edges at job level', () => {
    const { edges } = buildGraph(
      [job('lint'), job('test', ['lint'])],
      'job', [], null, false, onSelect, onDrillDown,
    );
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('lint');
    expect(edges[0].target).toBe('test');
  });

  it('creates no edge for unknown needs dependency', () => {
    const { edges } = buildGraph(
      [job('test', ['missing'])],
      'job', [], null, false, onSelect, onDrillDown,
    );
    expect(edges).toHaveLength(0);
  });

  it('uses grid layout for steps (no edges)', () => {
    const steps = [
      { id: '0', name: 'Step 1' },
      { id: '1', name: 'Step 2' },
      { id: '2', name: 'Step 3' },
      { id: '3', name: 'Step 4' },
    ];
    const { nodes } = buildGraph(steps, 'step', [], null, false, onSelect, undefined);
    // 4th node should be on row 2 (grid layout)
    expect(nodes[3].position.x).toBe(nodes[0].position.x);
    expect(nodes[3].position.y).toBeGreaterThan(nodes[0].position.y);
  });

  it('uses grid layout for jobs with no edges', () => {
    const { nodes } = buildGraph([job('a'), job('b'), job('c'), job('d')], 'job', [], null, false, onSelect);
    expect(nodes[3].position.x).toBe(nodes[0].position.x);
  });

  it('marks selected item with isSelected=true', () => {
    const items = [job('lint'), job('test')];
    const { nodes } = buildGraph(items, 'job', [], items[1], false, onSelect, onDrillDown);
    expect((nodes[0].data as { isSelected: boolean }).isSelected).toBe(false);
    expect((nodes[1].data as { isSelected: boolean }).isSelected).toBe(true);
  });

  it('creates uses edges at orchestrator level', () => {
    const workflows: WorkflowData[] = [
      { id: 'deploy.yml', filename: 'deploy.yml', on: {}, jobs: {} },
    ];
    const items = [
      orc('ci.yml', ['deploy.yml']),
      { ...workflows[0], id: 'deploy.yml', triggers: [], calledWorkflows: [], workflow: workflows[0] } as OrchestratorData,
    ];
    const { edges } = buildGraph(items, 'orchestrator', workflows, null, false, onSelect, onDrillDown);
    expect(edges.some(e => e.source === 'ci.yml' && e.target === 'deploy.yml')).toBe(true);
  });
});
