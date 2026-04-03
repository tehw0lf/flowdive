import { motion, AnimatePresence } from 'framer-motion';
import { X, Terminal, GitBranch, Workflow, Cpu, Play } from 'lucide-react';
import type { Level, OrchestratorData, WorkflowData, JobData, StepData } from '../types';

interface DetailPanelProps {
  level: Level;
  data: OrchestratorData | WorkflowData | JobData | StepData | null;
  onClose: () => void;
  side?: 'left' | 'right';
}

const levelIcons = {
  orchestrator: GitBranch,
  workflow: Workflow,
  job: Cpu,
  step: Play,
};

const levelColors = {
  orchestrator: 'blue',
  workflow: 'teal',
  job: 'green',
  step: 'amber',
};

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-gray-500">—</span>;
  if (typeof value === 'string') return <span className="text-green-300">{value}</span>;
  if (typeof value === 'boolean') return <span className="text-amber-300">{String(value)}</span>;
  if (typeof value === 'number') return <span className="text-blue-300">{value}</span>;
  return (
    <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-mono">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-gray-500 font-mono min-w-28 shrink-0">{label}</span>
      <span className="text-gray-200 font-mono break-all"><JsonBlock value={value} /></span>
    </div>
  );
}

function OrchestratorDetail({ data }: { data: OrchestratorData }) {
  const wf = data.workflow;
  return (
    <>
      <Section title="Triggers">
        {data.triggers.map(t => (
          <div key={t} className="text-xs text-blue-300 font-mono">• {t}</div>
        ))}
      </Section>

      {data.calledWorkflows.length > 0 && (
        <Section title="Called Workflows">
          {data.calledWorkflows.map((w, i) => (
            <div key={i} className="text-xs text-gray-300 font-mono break-all">• {w}</div>
          ))}
        </Section>
      )}

      {wf.on?.workflow_dispatch?.inputs && (
        <Section title="Dispatch Inputs">
          {Object.entries(wf.on.workflow_dispatch.inputs).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
        </Section>
      )}

      {wf.env && (
        <Section title="Environment">
          {Object.entries(wf.env).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
        </Section>
      )}

      {wf.concurrency && <Row label="concurrency" value={wf.concurrency} />}
      {wf.permissions && <Row label="permissions" value={wf.permissions} />}
    </>
  );
}

function WorkflowDetail({ data }: { data: WorkflowData }) {
  const allInputs = data.on?.workflow_call?.inputs ?? data.on?.workflow_dispatch?.inputs ?? {};
  const secrets = data.on?.workflow_call?.secrets ?? {};

  return (
    <>
      <Section title="Triggers & Config">
        <Row label="name" value={data.name ?? '—'} />
        <Row label="filename" value={data.filename} />
      </Section>

      {Object.keys(allInputs).length > 0 && (
        <Section title="Inputs">
          {Object.entries(allInputs).map(([k, v]) => (
            <div key={k} className="mb-2">
              <div className="text-xs text-teal-400 font-mono font-semibold">{k}</div>
              <div className="pl-2 space-y-0.5">
                {typeof v === 'object' && v !== null && Object.entries(v as Record<string, unknown>).map(([ik, iv]) => (
                  <Row key={ik} label={ik} value={iv} />
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}

      {Object.keys(secrets).length > 0 && (
        <Section title="Secrets">
          {Object.entries(secrets).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
        </Section>
      )}

      {data.env && (
        <Section title="Env">
          {Object.entries(data.env).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
        </Section>
      )}

      {data.permissions && <Section title="Permissions"><Row label="permissions" value={data.permissions} /></Section>}
      {data.defaults && <Section title="Defaults"><JsonBlock value={data.defaults} /></Section>}
      {data.concurrency && <Section title="Concurrency"><JsonBlock value={data.concurrency} /></Section>}
    </>
  );
}

function JobDetail({ data }: { data: JobData }) {
  return (
    <>
      <Section title="Runner">
        <Row label="runs-on" value={data['runs-on']} />
        {data.needs && <Row label="needs" value={data.needs} />}
        {data.if && <Row label="if" value={data.if} />}
        {data['timeout-minutes'] && <Row label="timeout" value={`${data['timeout-minutes']}m`} />}
        {data.environment && <Row label="environment" value={data.environment} />}
        {data.concurrency !== undefined && <Row label="concurrency" value={data.concurrency as string} />}
      </Section>

      {data.permissions && (
        <Section title="Permissions">
          <JsonBlock value={data.permissions} />
        </Section>
      )}

      {data.strategy && (
        <Section title="Strategy">
          <JsonBlock value={data.strategy} />
        </Section>
      )}

      {data.outputs && (
        <Section title="Outputs">
          {Object.entries(data.outputs).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
        </Section>
      )}

      {data.uses && (
        <Section title="Reusable Workflow">
          <Row label="uses" value={data.uses} />
          {data.with && <Row label="with" value={data.with} />}
          {data.secrets && <Row label="secrets" value={data.secrets} />}
        </Section>
      )}

      {data.env && (
        <Section title="Env">
          {Object.entries(data.env as Record<string, unknown>).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
        </Section>
      )}
    </>
  );
}

function StepDetail({ data }: { data: StepData }) {
  return (
    <>
      <Section title="Action">
        {data.uses && <Row label="uses" value={data.uses} />}
        {data.if && <Row label="if" value={data.if} />}
        {data['timeout-minutes'] && <Row label="timeout" value={`${data['timeout-minutes']}m`} />}
        {data['continue-on-error'] !== undefined && (
          <Row label="continue-on-error" value={data['continue-on-error']} />
        )}
      </Section>

      {data.run && (
        <Section title="Script">
          <pre className="text-xs text-green-300 bg-black/40 rounded p-2 whitespace-pre-wrap break-all font-mono">
            {data.run}
          </pre>
        </Section>
      )}

      {data.with && Object.keys(data.with).length > 0 && (
        <Section title="With (Inputs)">
          {Object.entries(data.with).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
        </Section>
      )}

      {data.env && Object.keys(data.env).length > 0 && (
        <Section title="Env">
          {Object.entries(data.env).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
        </Section>
      )}
    </>
  );
}

export function DetailPanel({ level, data, onClose, side = 'right' }: DetailPanelProps) {
  const Icon = levelIcons[level];
  const color = levelColors[level];

  const name = data
    ? 'name' in data && data.name
      ? data.name
      : 'filename' in data
      ? (data as OrchestratorData).filename
      : (data as JobData | StepData).id
    : '';

  return (
    <AnimatePresence>
      {data && (
        <motion.aside
          key="detail"
          initial={{ opacity: 0, x: side === 'right' ? 40 : -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: side === 'right' ? 40 : -40 }}
          transition={{ duration: 0.25 }}
          className={`
            fixed top-0 ${side === 'right' ? 'right-0' : 'left-0'} bottom-0
            w-80 z-40 hud-panel flex flex-col
            border-${side === 'right' ? 'l' : 'r'} border-blue-500/20
          `}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b border-blue-500/10 bg-${color}-500/10`}>
            <div className="flex items-center gap-2 min-w-0">
              <Icon size={14} className={`text-${color}-400`} />
              <span className={`text-sm font-mono font-semibold text-${color}-400 truncate`}>{name}</span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-200 transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          {/* Level badge */}
          <div className="px-4 py-2 border-b border-blue-500/10">
            <span className={`text-xs font-mono uppercase tracking-widest text-${color}-400/70`}>
              <Terminal size={10} className="inline mr-1" />
              {level}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin hud-scanline">
            {level === 'orchestrator' && <OrchestratorDetail data={data as OrchestratorData} />}
            {level === 'workflow' && <WorkflowDetail data={data as WorkflowData} />}
            {level === 'job' && <JobDetail data={data as JobData} />}
            {level === 'step' && <StepDetail data={data as StepData} />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
