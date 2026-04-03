/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTilt } from '../hooks/useTilt';
import {
  ReactFlow,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  Handle,
  Position,
  type NodeTypes,
  type Node,
  type Edge,
  type Connection,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Workflow, ExternalLink, Terminal, ChevronsRight } from 'lucide-react';
import type { Level, OrchestratorData, WorkflowData, JobData, StepData, DrillState } from '../types';
import { levelConfig, resolveCardName, OrchestratorPills, WorkflowPills, JobPills, StepPills } from './CardPills';

type AnyCardData = OrchestratorData | WorkflowData | JobData | StepData;

// ─── Dagre layout ─────────────────────────────────────────────────────────────

const NODE_WIDTH = 240;
const NODE_HEIGHT = 88;
const GRID_COLS = 3;
const GRID_GAP_X = 16;
const GRID_GAP_Y = 16;

export function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 48, ranksep: 64 });

  nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach(e => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map(n => {
    const { x, y } = g.node(n.id);
    return { ...n, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } };
  });
}

export function applyGridLayout(nodes: Node[]): Node[] {
  return nodes.map((n, i) => ({
    ...n,
    position: {
      x: (i % GRID_COLS) * (NODE_WIDTH + GRID_GAP_X),
      y: Math.floor(i / GRID_COLS) * (NODE_HEIGHT + GRID_GAP_Y),
    },
  }));
}

// ─── Custom node ──────────────────────────────────────────────────────────────

interface WorkflowNodeData extends Record<string, unknown> {
  item: AnyCardData;
  level: Level;
  isSelected: boolean;
  drillsIntoWorkflow: boolean;
  usesUnresolved: boolean;
  effectsEnabled: boolean;
  onSelect: (item: AnyCardData, e: React.MouseEvent) => void;
  onDrillDown?: (item: AnyCardData, e: React.MouseEvent) => void;
}

function WorkflowNode({ data }: { data: WorkflowNodeData }) {
  const { item, level, isSelected, drillsIntoWorkflow, usesUnresolved, effectsEnabled, onSelect, onDrillDown } = data;
  const config = levelConfig[level];
  const effectiveConfig = (level === 'job' && drillsIntoWorkflow) ? levelConfig.workflow : config;
  const Icon = drillsIntoWorkflow ? Workflow : config.icon;
  const name = resolveCardName(level, item);

  const ringColor =
    level === 'orchestrator' ? 'ring-blue-400/50'
    : level === 'workflow' ? 'ring-teal-400/50'
    : level === 'job' ? (drillsIntoWorkflow ? 'ring-teal-400/50' : 'ring-green-400/50')
    : 'ring-amber-400/50';

  const isReusableOnly = level === 'orchestrator'
    && (item as OrchestratorData).calledWorkflows?.length === 0;

  const canDrillDown = onDrillDown && !usesUnresolved && level !== 'step';

  const tilt = useTilt();

  /* eslint-disable react-hooks/refs */
  return (
    <motion.div
      ref={tilt.ref}
      data-card
      onMouseMove={effectsEnabled ? tilt.onMouseMove : undefined}
      onMouseLeave={effectsEnabled ? tilt.onMouseLeave : undefined}
      style={effectsEnabled
        ? { opacity: isReusableOnly ? 0.55 : 1, width: NODE_WIDTH, rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: 800 }
        : { opacity: isReusableOnly ? 0.55 : 1, width: NODE_WIDTH }}
      className={`
        rounded-lg border overflow-hidden flex
        ${effectiveConfig.border} ${effectiveConfig.bg} ${effectiveConfig.glow}
        ${isSelected ? `ring-2 ${ringColor}` : ''}
        hover:opacity-100 transition-opacity duration-150
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-2 !h-2 !top-0" />

      {/* Main area — click opens popup */}
      <div
        className="flex-1 min-w-0 cursor-pointer select-none"
        role="button"
        tabIndex={0}
        aria-label={`View details for ${name}`}
        onClick={e => onSelect(item, e)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item, e as unknown as React.MouseEvent); } }}
      >
        {/* Header */}
        <div className={`${effectiveConfig.headerBg} px-2.5 py-1.5 border-b ${effectiveConfig.border} flex items-center gap-1.5`}>
          <Icon size={11} className={effectiveConfig.accent} />
          <span className={`text-xs font-semibold font-mono truncate ${effectiveConfig.accent}`}>{name}</span>
          {usesUnresolved && (
            <span className="ml-auto shrink-0 text-gray-600">
              <ExternalLink size={10} />
            </span>
          )}
          {level === 'step' && (item as StepData).run && (
            <Terminal size={10} className="ml-auto text-amber-500/50 shrink-0" />
          )}
        </div>

        {/* Pills */}
        <div className="px-2.5 py-2 flex flex-wrap gap-1">
          {level === 'orchestrator' && <OrchestratorPills data={item as OrchestratorData} config={effectiveConfig} />}
          {level === 'workflow'     && <WorkflowPills     data={item as WorkflowData}     config={effectiveConfig} />}
          {level === 'job'          && <JobPills          data={item as JobData}           config={effectiveConfig} drillsIntoWorkflow={drillsIntoWorkflow} />}
          {level === 'step'         && <StepPills         data={item as StepData}          config={effectiveConfig} />}
        </div>
      </div>

      {/* Drill-down strip */}
      {canDrillDown && (
        <button
          onClick={e => { e.stopPropagation(); onDrillDown!(item, e); }}
          title={drillsIntoWorkflow ? 'Open reusable workflow' : 'Drill into'}
          aria-label={drillsIntoWorkflow ? `Open reusable workflow ${name}` : `Drill into ${name}`}
          className={`
            shrink-0 w-14 flex flex-col items-center justify-center
            border-l transition-all duration-150 group
            ${effectiveConfig.stripColors}
          `}
        >
          <ChevronsRight size={12} aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-2 !h-2 !bottom-0" />
    </motion.div>
  );
  /* eslint-enable react-hooks/refs */
}

const nodeTypes: NodeTypes = { workflowNode: WorkflowNode };

// ─── Edge styles ──────────────────────────────────────────────────────────────

const usesEdge = {
  type: 'bezier',
  animated: false,
  style: { stroke: '#14b8a650', strokeWidth: 1.5 },
  markerEnd: { type: 'arrowclosed' as const, color: '#14b8a650', width: 14, height: 14 },
};

const needsEdge = {
  type: 'bezier',
  animated: false,
  style: { stroke: '#3b82f630', strokeWidth: 1, strokeDasharray: '4 3' },
  markerEnd: { type: 'arrowclosed' as const, color: '#3b82f640', width: 12, height: 12 },
};

// ─── Resolve uses: to a loaded workflow id ────────────────────────────────────

export function resolveUsesId(uses: string, workflows: WorkflowData[]): string | null {
  const withoutRef = uses.replace(/@[^@]*$/, '');
  const filename = withoutRef.split('/').at(-1) ?? withoutRef;
  const found = workflows.find(w =>
    w.id === filename || w.id === withoutRef ||
    w.filename === filename || w.filename.endsWith('/' + filename)
  );
  return found?.id ?? null;
}

// ─── Build nodes + edges ──────────────────────────────────────────────────────

export function buildGraph(
  items: AnyCardData[],
  level: Level,
  workflows: WorkflowData[],
  selectedItem: AnyCardData | null,
  effectsEnabled: boolean,
  onSelect: (item: AnyCardData, e: React.MouseEvent) => void,
  onDrillDown?: (item: AnyCardData, e: React.MouseEvent) => void,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const nodeIds = new Set(items.map((it, idx) => 'id' in it ? (it as { id: string }).id : String(idx)));

  items.forEach((item, i) => {
    const id = 'id' in item ? (item as { id: string }).id : String(i);

    const job = level === 'job' ? item as JobData : null;
    const resolvedWfId = job?.uses ? resolveUsesId(job.uses, workflows) : null;
    const drillsIntoWorkflow = !!resolvedWfId;
    const usesUnresolved = !!(job?.uses && !resolvedWfId);

    nodes.push({
      id,
      type: 'workflowNode',
      position: { x: 0, y: 0 },
      data: {
        item,
        level,
        isSelected: selectedItem === item,
        drillsIntoWorkflow,
        usesUnresolved,
        effectsEnabled,
        onSelect,
        onDrillDown: level !== 'step' ? onDrillDown : undefined,
      } as WorkflowNodeData,
    });

    // Edges: uses: connections at orchestrator level
    if (level === 'orchestrator') {
      const orc = item as OrchestratorData;
      orc.calledWorkflows.forEach(uses => {
        const targetId = resolveUsesId(uses, items.filter(it => 'filename' in it) as WorkflowData[]);
        if (targetId) {
          edges.push({ id: `uses::${id}::${targetId}`, source: id, target: targetId, ...usesEdge });
        }
      });
    }

    // Edges: needs: at job level
    if (level === 'job') {
      const jobItem = item as JobData;
      const needs = jobItem.needs
        ? Array.isArray(jobItem.needs) ? jobItem.needs : [jobItem.needs]
        : [];
      needs.forEach(n => {
        if (nodeIds.has(n)) {
          edges.push({ id: `needs::${n}::${id}`, source: n, target: id, ...needsEdge });
        }
      });
    }
  });

  const useGrid = level === 'step' || edges.length === 0;
  const layoutedNodes = useGrid ? applyGridLayout(nodes) : applyDagreLayout(nodes, edges);
  return { nodes: layoutedNodes, edges };
}

// ─── GraphView ────────────────────────────────────────────────────────────────

interface GraphViewProps {
  items: AnyCardData[];
  level: Level;
  workflows: WorkflowData[];
  drillState: DrillState;
  selectedItem: AnyCardData | null;
  effectsEnabled: boolean;
  onSelect: (item: AnyCardData, e: React.MouseEvent) => void;
  onDrillDown?: (item: AnyCardData, e: React.MouseEvent) => void;
  onPaneClick?: () => void;
}

function GraphViewInner({ items, level, workflows, selectedItem, effectsEnabled, onSelect, onDrillDown, onPaneClick }: GraphViewProps) {
  const { nodes: computedNodes, edges: computedEdges } = useMemo(
    () => buildGraph(items, level, workflows, selectedItem, effectsEnabled, onSelect, onDrillDown),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, level, workflows, selectedItem],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);
  const { fitView } = useReactFlow();

  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
  }, [computedNodes, computedEdges, setNodes, setEdges, fitView]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge(connection, eds));
  }, [setEdges]);

  return (
    <div className="w-full h-full" style={{ minHeight: 400, background: 'transparent' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        colorMode="dark"
        proOptions={{ hideAttribution: false }}
      >
        <Controls
          className="!bg-[#020408] !border-blue-500/20"
          style={{ button: { background: '#020408', borderColor: '#3b82f620', color: '#4b5563' } } as React.CSSProperties}
        />
        <MiniMap
          nodeColor={n => {
            const d = n.data as WorkflowNodeData;
            const l = d?.level as Level;
            return l === 'orchestrator' ? '#3b82f6' : l === 'workflow' ? '#14b8a6' : l === 'job' ? '#22c55e' : '#f59e0b';
          }}
          style={{ background: '#020408', border: '1px solid #3b82f620' }}
          maskColor="#020408cc"
        />
      </ReactFlow>
    </div>
  );
}

export function GraphView(props: GraphViewProps) {
  return (
    <ReactFlowProvider>
      <GraphViewInner {...props} />
    </ReactFlowProvider>
  );
}
