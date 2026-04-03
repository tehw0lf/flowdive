import { Activity, Database, Layers, Zap } from 'lucide-react';
import type { DrillState, WorkflowData, JobData } from '../types';

const levelMeta = {
  orchestrator: {
    label: 'ORCHESTRATORS',
    sublabel: 'Entry Points',
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    icon: Zap,
  },
  workflow: {
    label: 'WORKFLOW',
    sublabel: 'Reusable',
    color: 'text-teal-400',
    border: 'border-teal-500/20',
    icon: Layers,
  },
  job: {
    label: 'JOBS',
    sublabel: 'Parallel units',
    color: 'text-green-400',
    border: 'border-green-500/20',
    icon: Database,
  },
  step: {
    label: 'STEPS',
    sublabel: 'Actions',
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    icon: Activity,
  },
};

function Readout({ label, value, color, effectsEnabled }: { label: string; value: string | number; color: string; effectsEnabled: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-600 uppercase tracking-widest font-mono">{label}</span>
      <span className={`text-lg font-mono font-bold ${color} ${effectsEnabled ? 'animate-pulse-glow' : ''}`}>{value}</span>
    </div>
  );
}

export function HudTopBar({ drillState, currentItems, effectsEnabled = true }: { drillState: DrillState; currentItems: unknown[]; effectsEnabled?: boolean }) {
  const meta = levelMeta[drillState.level];
  const Icon = meta.icon;

  return (
    <div className={`hud-panel border rounded-lg px-4 py-2 flex items-center gap-6 ${meta.border}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} className={meta.color} />
        <span className={`text-sm font-mono font-semibold ${meta.color}`}>{meta.label}</span>
        <span className="text-xs text-gray-600 font-mono">/ {meta.sublabel}</span>
      </div>
      <div className="flex items-center gap-4 ml-auto">
        <Readout label="count" value={currentItems.length} color={meta.color} effectsEnabled={effectsEnabled} />
        <Readout label="depth" value={
          drillState.level === 'orchestrator' ? '01'
          : drillState.level === 'workflow' ? '02'
          : drillState.level === 'job' ? '03' : '04'
        } color={meta.color} effectsEnabled={effectsEnabled} />
      </div>
    </div>
  );
}

export function HudSidePanel({ drillState, workflows, position, effectsEnabled = true }: {
  drillState: DrillState;
  workflows: WorkflowData[];
  position: 'left' | 'right';
  effectsEnabled?: boolean;
}) {
  const meta = levelMeta[drillState.level];

  // Left panel: contextual stats
  if (position === 'left') {
    const totalJobs = workflows.reduce((acc, w) => acc + Object.keys(w.jobs || {}).length, 0);
    const totalSteps = workflows.reduce((acc, w) =>
      acc + Object.values(w.jobs || {}).reduce((jacc, j) => jacc + ((j as JobData).steps?.length ?? 0), 0), 0);

    return (
      <div className={`hud-panel border rounded-lg p-4 space-y-4 ${meta.border} ${effectsEnabled ? 'hud-scanline' : ''}`}>
        <div className={`text-xs font-mono uppercase tracking-widest ${meta.color} mb-2`}>
          CORPUS STATS
        </div>
        <Readout label="workflows" value={workflows.length} color="text-blue-400" effectsEnabled={effectsEnabled} />
        <Readout label="total jobs" value={totalJobs} color="text-green-400" effectsEnabled={effectsEnabled} />
        <Readout label="total steps" value={totalSteps} color="text-amber-400" effectsEnabled={effectsEnabled} />

        <div className="border-t border-blue-500/10 pt-3 mt-3">
          <div className="text-xs text-gray-600 uppercase tracking-widest font-mono mb-2">ACTIVE LAYER</div>
          <div className={`text-2xl font-mono font-black ${meta.color}`}>
            {drillState.level.toUpperCase().slice(0, 4)}
          </div>
        </div>
      </div>
    );
  }

  // Right panel: inherited config / live stub
  return (
    <div className={`hud-panel border rounded-lg p-4 space-y-3 ${meta.border} ${effectsEnabled ? 'hud-scanline' : ''}`}>
      <div className={`text-xs font-mono uppercase tracking-widest ${meta.color} mb-2`}>
        CONTEXT
      </div>

      {drillState.orchestratorId && (
        <div>
          <div className="text-xs text-gray-600 font-mono uppercase tracking-wider">Orchestrator</div>
          <div className="text-xs text-blue-300 font-mono truncate">{drillState.orchestratorId}</div>
        </div>
      )}

      {drillState.workflowId && (
        <div>
          <div className="text-xs text-gray-600 font-mono uppercase tracking-wider">Workflow</div>
          <div className="text-xs text-teal-300 font-mono truncate">{drillState.workflowId}</div>
        </div>
      )}

      {drillState.jobId && (
        <div>
          <div className="text-xs text-gray-600 font-mono uppercase tracking-wider">Job</div>
          <div className="text-xs text-green-300 font-mono truncate">{drillState.jobId}</div>
        </div>
      )}

    </div>
  );
}
