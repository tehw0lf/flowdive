import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, GitFork } from 'lucide-react';

import type {
  DrillState, BreadcrumbItem,
  OrchestratorData, WorkflowData, JobData, StepData,
} from './types';
import { parseMultipleFiles, getJobsFromWorkflow, getStepsFromJob, resolveUsesRef } from './parser';

import { ParticleBackground } from './components/ParticleBackground';
import { Breadcrumb } from './components/Breadcrumb';
import { LevelCard } from './components/LevelCard';
import { CardPopup } from './components/CardPopup';
import type { PopupState } from './components/CardPopup';
import { HudTopBar, HudSidePanel } from './components/HudPanel';
import { RippleOverlay, CardPoolWrapper } from './components/RippleTransition';
import { YamlLoader } from './components/YamlLoader';
import './index.css';

const GraphView = lazy(() => import('./components/GraphView').then(m => ({ default: m.GraphView })));

type AnyCardData = OrchestratorData | WorkflowData | JobData | StepData;

// ─── URL ↔ DrillState sync ────────────────────────────────────────────────────

function drillStateToParams(state: DrillState): URLSearchParams {
  const p = new URLSearchParams();
  p.set('level', state.level);
  if (state.orchestratorId) p.set('orc', state.orchestratorId);
  if (state.workflowId) p.set('wf', state.workflowId);
  if (state.jobId) p.set('job', state.jobId);
  return p;
}

function paramsToPartialDrillState(p: URLSearchParams): Partial<DrillState> {
  const level = p.get('level') as DrillState['level'] | null;
  if (!level || !['orchestrator', 'workflow', 'job', 'step'].includes(level)) return {};
  return {
    level,
    orchestratorId: p.get('orc') ?? undefined,
    workflowId: p.get('wf') ?? undefined,
    jobId: p.get('job') ?? undefined,
  };
}

function useRipple() {
  const [ripple, setRipple] = useState<{ visible: boolean; origin: { x: number; y: number } }>({
    visible: false,
    origin: { x: 0, y: 0 },
  });

  const trigger = useCallback((origin: { x: number; y: number }) => {
    setRipple({ visible: true, origin });
    setTimeout(() => setRipple(r => ({ ...r, visible: false })), 800);
  }, []);

  return { ripple, trigger };
}

export default function App() {
  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [, setOrchestrators] = useState<OrchestratorData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

  const initialDrillState = useMemo<DrillState>(() => {
    const partial = paramsToPartialDrillState(new URLSearchParams(window.location.search));
    return partial.level ? { level: partial.level, ...partial } : { level: 'orchestrator' };
  }, []);

  const [drillState, setDrillState] = useState<DrillState>(initialDrillState);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'graph'>('graph');
  const [effects, setEffects] = useState(true);

  // Sync drillState → URL
  useEffect(() => {
    const params = drillStateToParams(drillState);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [drillState]);

  const { ripple, trigger } = useRipple();

  // ─── Data loading ────────────────────────────────────────────────
  const handleLoad = useCallback((files: { name: string; content: string }[]) => {
    const { workflows: wfs, orchestrators: orcs } = parseMultipleFiles(files);
    setWorkflows(prev => {
      const existing = new Map(prev.map(w => [w.id, w]));
      wfs.forEach(w => existing.set(w.id, w));
      return Array.from(existing.values());
    });
    setOrchestrators(prev => {
      const existing = new Map(prev.map(o => [o.id, o]));
      orcs.forEach(o => existing.set(o.id, o));
      return Array.from(existing.values());
    });
    setLoaded(true);
    setShowLoader(false);
    // Reset navigation only on first load (prev is empty)
    setDrillState(prev => {
      if (prev.level === 'orchestrator' && !prev.orchestratorId) return { level: 'orchestrator' };
      return prev;
    });
    setPopup(null);
  }, []);

  // ─── Resolve the active workflow from drill state ────────────────
  const resolveActiveWorkflow = (state: DrillState): WorkflowData | null => {
    if (state.workflowId) return workflows.find(w => w.id === state.workflowId) ?? null;
    if (state.orchestratorId) return workflows.find(w => w.id === state.orchestratorId) ?? null;
    return null;
  };

  // ─── Derive current items from drill state ────────────────────────
  const currentItems = (): AnyCardData[] => {
    const { level, jobId } = drillState;

    if (level === 'orchestrator') {
      const toOrc = (w: WorkflowData): OrchestratorData => ({
        id: w.id,
        filename: w.filename,
        name: w.name,
        triggers: Object.keys(w.on ?? {}),
        calledWorkflows: Object.values(w.jobs ?? {}).flatMap(j => (j as JobData).uses ? [(j as JobData).uses!] : []),
        workflow: w,
      });
      const isOrc = (w: WorkflowData) => Object.values(w.jobs ?? {}).some(j => !!(j as JobData).uses);
      const orcs = workflows.filter(isOrc);
      // If orchestrators exist: show only them
      // If none exist (pure reusable repo): show all workflows as fallback
      return orcs.length > 0 ? orcs.map(toOrc) : workflows.map(toOrc);
    }

    if (level === 'job') {
      const wf = resolveActiveWorkflow(drillState);
      return wf ? getJobsFromWorkflow(wf) : [];
    }

    if (level === 'step') {
      const wf = resolveActiveWorkflow(drillState);
      if (!wf || !jobId) return [];
      const jobs = getJobsFromWorkflow(wf);
      const job = jobs.find(j => j.id === jobId);
      return job ? getStepsFromJob(job) : [];
    }

    return [];
  };

  // ─── Navigation ──────────────────────────────────────────────────
  const drillInto = (item: AnyCardData, e: React.MouseEvent) => {
    const origin = { x: e.clientX, y: e.clientY };
    if (effects) trigger(origin);
    resetFocus();

    setTimeout(() => {
      const { level } = drillState;

      if (level === 'orchestrator') {
        const orc = item as OrchestratorData;
        setDrillState({ level: 'job', orchestratorId: orc.id, clickOrigin: origin });
        setBreadcrumb([{ level: 'orchestrator', label: orc.name ?? orc.filename, orchestratorId: orc.id }]);
        setPopup(null);
      } else if (level === 'workflow') {
        const wf = item as WorkflowData;
        setDrillState(prev => ({ ...prev, level: 'job', workflowId: wf.id, clickOrigin: origin }));
        setBreadcrumb(prev => [...prev, { level: 'workflow', label: wf.name ?? wf.filename, workflowId: wf.id }]);
        setPopup(null);
      } else if (level === 'job') {
        const job = item as JobData;
        // If this job calls a reusable workflow that's loaded, drill into it
        const resolved = job.uses ? resolveUsesRef(job.uses, workflows) : null;
        if (resolved) {
          setDrillState(prev => ({ ...prev, level: 'job', workflowId: resolved.id, jobId: undefined, clickOrigin: origin }));
          setBreadcrumb(prev => [...prev, { level: 'job', label: job.name ?? job.id, jobId: job.id, workflowId: resolved.id }]);
        } else {
          setDrillState(prev => ({ ...prev, level: 'step', jobId: job.id, clickOrigin: origin }));
          setBreadcrumb(prev => [...prev, { level: 'job', label: job.name ?? job.id, jobId: job.id }]);
        }
        setPopup(null);
      }
    }, 200);
  };

  const navigateTo = (breadcrumbIndex: number) => {
    resetFocus();
    if (breadcrumbIndex === 0) {
      setDrillState({ level: 'orchestrator' });
      setBreadcrumb([]);
      setPopup(null);
      return;
    }

    const target = breadcrumb[breadcrumbIndex - 1];
    const newBreadcrumb = breadcrumb.slice(0, breadcrumbIndex);

    if (target.level === 'orchestrator') {
      setDrillState({ level: 'job', orchestratorId: target.orchestratorId });
    } else if (target.level === 'workflow') {
      setDrillState(prev => ({ ...prev, level: 'job', workflowId: target.workflowId, jobId: undefined }));
    } else if (target.level === 'job') {
      // If this job breadcrumb has a workflowId, it was a uses: drill → go back to that workflow's jobs
      if (target.workflowId) {
        setDrillState(prev => ({ ...prev, level: 'job', workflowId: target.workflowId, jobId: undefined }));
      } else {
        setDrillState(prev => ({ ...prev, level: 'step', jobId: target.jobId }));
      }
    }

    setBreadcrumb(newBreadcrumb);
    setPopup(null);
  };

  const openPopup = (item: AnyCardData, e: React.MouseEvent) => {
    const card = (e.currentTarget as HTMLElement).closest('[data-card]') as HTMLElement | null;
    const anchorRect = card?.getBoundingClientRect() ?? (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopup(prev =>
      prev?.data === item ? null : { data: item, level: drillState.level, anchorRect }
    );
  };

  const items = currentItems();
  const drillKey = `${drillState.level}-${drillState.orchestratorId ?? ''}-${drillState.workflowId ?? ''}-${drillState.jobId ?? ''}`;

  // ─── Arrow key navigation (grid mode only) ───────────────────────
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const cardGridRef = useRef<HTMLDivElement>(null);

  const resetFocus = () => setFocusedIndex(-1);

  // Focus the DOM button of the focused card
  useEffect(() => {
    if (focusedIndex < 0 || viewMode !== 'grid') return;
    const cards = cardGridRef.current?.querySelectorAll<HTMLElement>('[role="button"]');
    cards?.[focusedIndex]?.focus();
  }, [focusedIndex, viewMode]);

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (items.length === 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, 0));
    }
  };

  if (!loaded) {
    return (
      <div className="relative min-h-screen bg-[#020408]">
        <ParticleBackground />
        <div className="grid-bg fixed inset-0 pointer-events-none z-0" />
        <YamlLoader onLoad={handleLoad} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#020408] text-white">
      <ParticleBackground />
      <div className="grid-bg fixed inset-0 pointer-events-none z-0" />

      {/* Screen reader live region for level changes */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {`Viewing ${drillState.level} level${drillState.jobId ? `, job ${drillState.jobId}` : ''}${drillState.workflowId ? `, workflow ${drillState.workflowId}` : ''}`}
      </div>

      {/* Ripple overlay */}
      <RippleOverlay visible={ripple.visible} origin={ripple.origin} />

      {/* Floating card popup */}
      <CardPopup
        popup={popup}
        onClose={() => setPopup(null)}
        workflows={workflows}
        onDrillDown={drillInto}
      />

      {/* In-app loader overlay – loads more files without resetting navigation */}
      <AnimatePresence>
        {showLoader && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#020408]/90 backdrop-blur-sm flex items-center justify-center"
            onClick={(e: React.MouseEvent) => { if (e.target === e.currentTarget) setShowLoader(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg mx-4"
            >
              <YamlLoader onLoad={handleLoad} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main layout */}
      <div className="relative z-10 flex h-screen overflow-hidden">
        {/* Left HUD */}
        <div className="hidden lg:flex flex-col w-48 shrink-0 p-3 gap-3 overflow-hidden">
          <div className="mt-14">
            <HudSidePanel drillState={drillState} workflows={workflows} position="left" effectsEnabled={effects} />
          </div>
          <button
            onClick={() => setShowLoader(true)}
            className="mt-auto text-xs font-mono text-gray-600 hover:text-gray-400 border border-gray-700/30 rounded px-2 py-1 transition-colors"
          >
            + LOAD FILES
          </button>
        </div>

        {/* Center content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar */}
          <div className="shrink-0 p-3 flex flex-col gap-2 border-b border-blue-500/10">
            <HudTopBar drillState={drillState} currentItems={items} effectsEnabled={effects} />
            <div className="flex items-center justify-between gap-4">
              <Breadcrumb items={breadcrumb} onNavigate={navigateTo} />
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-center border border-blue-500/20 rounded px-2 py-1">
                  <span className="text-xs font-mono text-gray-600 uppercase tracking-widest leading-none mb-0.5">view</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewMode('grid')}
                      title="Grid view"
                      aria-label="Switch to grid view"
                      aria-pressed={viewMode === 'grid'}
                      className={`text-xs transition-colors ${viewMode === 'grid' ? 'text-blue-300' : 'text-gray-600 hover:text-gray-400'}`}
                    >
                      <LayoutGrid size={12} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => setViewMode('graph')}
                      title="Graph view"
                      aria-label="Switch to graph view"
                      aria-pressed={viewMode === 'graph'}
                      className={`text-xs transition-colors ${viewMode === 'graph' ? 'text-blue-300' : 'text-gray-600 hover:text-gray-400'}`}
                    >
                      <GitFork size={12} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setEffects(e => !e)}
                  aria-label={`Toggle visual effects (currently ${effects ? 'on' : 'off'})`}
                  aria-pressed={effects}
                  className={`flex flex-col items-center border border-blue-500/20 rounded px-2 py-1 transition-colors ${effects ? 'text-blue-400/60 hover:text-blue-300' : 'text-gray-700 hover:text-gray-500'}`}
                >
                  <span className="text-xs font-mono uppercase tracking-widest leading-none mb-0.5" aria-hidden="true">effects</span>
                  <span className={`text-xs font-mono ${effects ? '' : 'line-through'}`} aria-hidden="true">{effects ? 'on' : 'off'}</span>
                </button>
                <button
                  onClick={() => setShowLoader(true)}
                  className="lg:hidden text-xs font-mono text-gray-600 hover:text-gray-400"
                >
                  + FILES
                </button>
              </div>
            </div>
          </div>

          {/* Card pool / Graph view */}
          <div className="flex-1 overflow-hidden relative">
            {viewMode === 'graph' ? (
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-gray-600 font-mono text-xs">Loading graph…</div>}>
                <GraphView
                  items={items}
                  level={drillState.level}
                  workflows={workflows}
                  drillState={drillState}
                  selectedItem={popup?.data ?? null}
                  effectsEnabled={effects}
                  onSelect={openPopup}
                  onDrillDown={drillState.level !== 'step' ? drillInto : undefined}
                  onPaneClick={() => setPopup(null)}
                />
              </Suspense>
            ) : (
              <div className="h-full overflow-y-auto p-4 scrollbar-thin">
                <AnimatePresence mode="wait">
                  <CardPoolWrapper drillKey={drillKey} level={drillState.level}>
                    {items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-600 font-mono text-sm">
                        <div className="text-2xl mb-2">⊘</div>
                        <div>No items at this level</div>
                      </div>
                    ) : (
                      <div
                        ref={cardGridRef}
                        role="list"
                        aria-label={`${drillState.level} cards`}
                        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
                        onKeyDown={handleGridKeyDown}
                      >
                        {items.map((item, i) => {
                          const key = 'id' in item ? (item as { id: string }).id : String(i);
                          const canDrillDown = drillState.level !== 'step';

                          const job = drillState.level === 'job' ? item as JobData : null;
                          const resolvedWf = job?.uses ? resolveUsesRef(job.uses, workflows) : null;
                          const drillsIntoWorkflow = !!resolvedWf;
                          const usesUnresolved = !!(job?.uses && !resolvedWf);

                          return (
                            <div key={key} data-card role="listitem">
                              <LevelCard
                                level={drillState.level}
                                data={item}
                                isSelected={popup?.data === item}
                                onSelect={e => openPopup(item, e)}
                                onDrillDown={canDrillDown ? e => drillInto(item, e) : undefined}
                                drillsIntoWorkflow={drillsIntoWorkflow}
                                usesUnresolved={usesUnresolved}
                                index={i}
                                effectsEnabled={effects}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardPoolWrapper>
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Right HUD */}
        <div className="hidden lg:flex flex-col w-48 shrink-0 p-3 gap-3 overflow-hidden">
          <div className="mt-14">
            <HudSidePanel drillState={drillState} workflows={workflows} position="right" effectsEnabled={effects} />
          </div>
        </div>
      </div>
    </div>
  );
}
