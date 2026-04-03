/* eslint-disable react-refresh/only-export-components */
import type { Level, OrchestratorData, WorkflowData, JobData, StepData } from '../types';
import { GitBranch, Workflow, Cpu, Play } from 'lucide-react';

// ─── Level config ─────────────────────────────────────────────────────────────

export const levelConfig = {
  orchestrator: {
    glow: 'card-glow-blue',
    border: 'border-blue-500/30',
    bg: 'bg-blue-950/20',
    headerBg: 'bg-blue-500/10',
    accent: 'text-blue-400',
    pillBg: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
    pillMuted: 'bg-blue-500/8 border-blue-500/20 text-blue-400/60',
    stripColors: 'bg-blue-500/10 hover:bg-blue-500/25 border-l-blue-500/30 text-blue-400/50 hover:text-blue-300',
    icon: GitBranch,
    canDrillDown: true,
  },
  workflow: {
    glow: 'card-glow-teal',
    border: 'border-teal-500/30',
    bg: 'bg-teal-950/20',
    headerBg: 'bg-teal-500/10',
    accent: 'text-teal-400',
    pillBg: 'bg-teal-500/15 border-teal-500/30 text-teal-300',
    pillMuted: 'bg-teal-500/8 border-teal-500/20 text-teal-400/60',
    stripColors: 'bg-teal-500/10 hover:bg-teal-500/25 border-l-teal-500/30 text-teal-400/50 hover:text-teal-300',
    icon: Workflow,
    canDrillDown: true,
  },
  job: {
    glow: 'card-glow-green',
    border: 'border-green-500/30',
    bg: 'bg-green-950/20',
    headerBg: 'bg-green-500/10',
    accent: 'text-green-400',
    pillBg: 'bg-green-500/15 border-green-500/30 text-green-300',
    pillMuted: 'bg-green-500/8 border-green-500/20 text-green-400/60',
    stripColors: 'bg-green-500/10 hover:bg-green-500/25 border-l-green-500/30 text-green-400/50 hover:text-green-300',
    icon: Cpu,
    canDrillDown: true,
  },
  step: {
    glow: 'card-glow-amber',
    border: 'border-amber-500/30',
    bg: 'bg-amber-950/20',
    headerBg: 'bg-amber-500/10',
    accent: 'text-amber-400',
    pillBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    pillMuted: 'bg-amber-500/8 border-amber-500/20 text-amber-400/60',
    stripColors: '',
    icon: Play,
    canDrillDown: false,
  },
};

export type LevelConfig = typeof levelConfig[Level];

// ─── Pill ─────────────────────────────────────────────────────────────────────

interface PillProps {
  label: string;
  value?: string;
  className: string;
}

export function Pill({ label, value, className }: PillProps) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border font-mono whitespace-nowrap ${className}`}>
      <span className="opacity-60">{label}</span>
      {value !== undefined && <span className="opacity-100 font-semibold">{value}</span>}
    </span>
  );
}

// ─── Per-level pill groups ────────────────────────────────────────────────────

export function OrchestratorPills({ data, config }: { data: OrchestratorData; config: LevelConfig }) {
  return (
    <>
      {data.triggers.map(t => (
        <Pill key={t} label={t} className={data.calledWorkflows.length > 0 ? config.pillBg : config.pillMuted} />
      ))}
      {data.calledWorkflows.length > 0 && (
        <Pill label="calls" value={String(data.calledWorkflows.length)} className={config.pillMuted} />
      )}
    </>
  );
}

export function WorkflowPills({ data, config }: { data: WorkflowData; config: LevelConfig }) {
  const inputs = data.on?.workflow_call?.inputs ?? data.on?.workflow_dispatch?.inputs ?? {};
  const secrets = data.on?.workflow_call?.secrets ?? {};
  const triggers = Object.keys(data.on ?? {});
  const jobCount = Object.keys(data.jobs ?? {}).length;

  return (
    <>
      {triggers.map(t => (
        <Pill key={t} label={t} className={config.pillBg} />
      ))}
      <Pill label="jobs" value={String(jobCount)} className={config.pillMuted} />
      {Object.keys(inputs).length > 0 && (
        <Pill label="inputs" value={String(Object.keys(inputs).length)} className={config.pillMuted} />
      )}
      {Object.keys(secrets).length > 0 && (
        <Pill label="secrets" value={String(Object.keys(secrets).length)} className={config.pillMuted} />
      )}
    </>
  );
}

export function JobPills({ data, config, drillsIntoWorkflow }: { data: JobData; config: LevelConfig; drillsIntoWorkflow?: boolean }) {
  const runsOn = Array.isArray(data['runs-on']) ? data['runs-on'].join('+') : data['runs-on'];
  const needs = data.needs
    ? Array.isArray(data.needs) ? data.needs : [data.needs]
    : [];
  const envName = typeof data.environment === 'string'
    ? data.environment
    : data.environment?.name;
  const matrixDims = data.strategy?.matrix
    ? Object.entries(data.strategy.matrix)
        .filter(([k]) => k !== 'include' && k !== 'exclude')
        .map(([, v]) => Array.isArray(v) ? v.length : 1)
        .reduce((a, b) => a * b, 1)
    : 0;

  return (
    <>
      {drillsIntoWorkflow
        ? <Pill label="uses" value={data.uses?.split('/').at(-1)?.replace(/@.*$/, '') ?? ''} className={config.pillBg} />
        : runsOn && <Pill label={runsOn} className={config.pillBg} />
      }
      {!drillsIntoWorkflow && (data.steps ?? []).length > 0 && (
        <Pill label="steps" value={String((data.steps ?? []).length)} className={config.pillMuted} />
      )}
      {needs.map(n => (
        <Pill key={n} label="needs" value={n} className={config.pillMuted} />
      ))}
      {envName && <Pill label="env" value={envName} className="bg-purple-500/15 border-purple-500/30 text-purple-300" />}
      {matrixDims > 0 && <Pill label="matrix" value={`×${matrixDims}`} className={config.pillMuted} />}
      {data.if && <Pill label="if" className="bg-yellow-500/10 border-yellow-500/20 text-yellow-400/70" />}
      {data['timeout-minutes'] && (
        <Pill label={`${data['timeout-minutes']}m`} className={config.pillMuted} />
      )}
    </>
  );
}

export function StepPills({ data, config }: { data: StepData; config: LevelConfig }) {
  return (
    <>
      {data.uses && (
        <Pill label={data.uses.split('@')[0].split('/').slice(-2).join('/')} className={config.pillBg} />
      )}
      {data.run && <Pill label="run" className={config.pillBg} />}
      {data.if && <Pill label="if" className="bg-yellow-500/10 border-yellow-500/20 text-yellow-400/70" />}
      {data.with && Object.keys(data.with).length > 0 && (
        <Pill label="with" value={String(Object.keys(data.with).length)} className={config.pillMuted} />
      )}
      {data.env && Object.keys(data.env).length > 0 && (
        <Pill label="env" value={String(Object.keys(data.env).length)} className={config.pillMuted} />
      )}
    </>
  );
}

// ─── Shared card name resolver ────────────────────────────────────────────────

export function resolveCardName(_level: Level, data: OrchestratorData | WorkflowData | JobData | StepData): string {
  if ('name' in data && data.name) return data.name;
  if ('filename' in data) return (data as OrchestratorData).filename;
  return (data as JobData | StepData).id;
}
