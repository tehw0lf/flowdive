import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Terminal, Copy, Check, ExternalLink, ChevronsRight } from 'lucide-react';
import type { Level, OrchestratorData, WorkflowData, JobData, StepData } from '../types';
import { levelConfig } from './LevelCard';
import { resolveUsesRef } from '../parser';

interface PopupState {
  data: OrchestratorData | WorkflowData | JobData | StepData;
  level: Level;
  anchorRect: DOMRect;
}

interface CardPopupProps {
  popup: PopupState | null;
  onClose: () => void;
  workflows?: WorkflowData[];
  onDrillDown?: (item: OrchestratorData | WorkflowData | JobData | StepData, e: React.MouseEvent) => void;
}

// ─── Copy block ───────────────────────────────────────────────────────────────

function CopyBlock({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="relative group">
      <pre className={`font-mono text-xs whitespace-pre-wrap break-all leading-relaxed ${className}`}>{text}</pre>
      <button
        onClick={copy}
        title="Copy to clipboard"
        aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-gray-500 hover:text-gray-200 bg-black/60"
      >
        {copied ? <Check size={11} className="text-green-400" aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
      </button>
    </div>
  );
}

// ─── Uses link ────────────────────────────────────────────────────────────────

/**
 * Resolves a `uses:` string to either:
 * - A local drill-in action (if the workflow is loaded)
 * - An external GitHub link (for org/repo/... or actions/... refs)
 */
function UsesLink({
  uses,
  workflows = [],
  onDrillDown,
  onClose,
  jobData,
}: {
  uses: string;
  workflows?: WorkflowData[];
  onDrillDown?: (item: JobData, e: React.MouseEvent) => void;
  onClose?: () => void;
  jobData?: JobData;
}) {
  const resolved = resolveUsesRef(uses, workflows);

  if (resolved && jobData && onDrillDown) {
    // Local workflow — drill-in button
    return (
      <button
        onClick={e => { onClose?.(); onDrillDown(jobData, e); }}
        className="flex items-center gap-1 text-xs font-mono text-teal-400 hover:text-teal-300 transition-colors group break-all text-left"
        title={`Drill into ${resolved.name ?? resolved.filename}`}
      >
        <ChevronsRight size={11} className="shrink-0 text-teal-500 group-hover:text-teal-300" />
        {uses}
      </button>
    );
  }

  // External ref — try to build a GitHub URL
  const href = buildGitHubUrl(uses);
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors group break-all"
        title="Open on GitHub"
      >
        <ExternalLink size={10} className="shrink-0 text-blue-500 group-hover:text-blue-300" />
        {uses}
      </a>
    );
  }

  // Fallback — plain text
  return <span className="text-xs font-mono text-gray-300 break-all">{uses}</span>;
}

/**
 * Build a github.com URL from a `uses:` string.
 *
 * Formats:
 *   actions/checkout@v4           → github.com/actions/checkout (tree/v4)
 *   org/repo/.github/workflows/f.yml@ref → github.com/org/repo/blob/ref/.github/workflows/f.yml
 *   ./.github/workflows/local.yml → null (local, no public URL)
 */
function buildGitHubUrl(uses: string): string | null {
  if (uses.startsWith('./') || uses.startsWith('/')) return null;

  const atIdx = uses.lastIndexOf('@');
  const ref = atIdx !== -1 ? uses.slice(atIdx + 1) : undefined;
  const path = atIdx !== -1 ? uses.slice(0, atIdx) : uses;

  const parts = path.split('/');
  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1];
  const rest = parts.slice(2);

  if (rest.length === 0) {
    // e.g. actions/checkout@v4
    return ref
      ? `https://github.com/${owner}/${repo}/tree/${ref}`
      : `https://github.com/${owner}/${repo}`;
  }

  // e.g. org/repo/.github/workflows/file.yml@ref
  const filePath = rest.join('/');
  return ref
    ? `https://github.com/${owner}/${repo}/blob/${ref}/${filePath}`
    : `https://github.com/${owner}/${repo}/blob/main/${filePath}`;
}

// ─── Content sections ─────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: unknown }) {
  const display = value === null || value === undefined ? '—'
    : typeof value === 'object' ? JSON.stringify(value, null, 2)
    : String(value);
  const isMultiline = display.includes('\n');

  return (
    <div className={`flex gap-2 text-xs ${isMultiline ? 'flex-col' : ''}`}>
      <span className="text-gray-500 font-mono shrink-0 min-w-24">{label}</span>
      {isMultiline
        ? <CopyBlock text={display} className="text-gray-300 bg-black/30 rounded p-1.5" />
        : <span className="text-gray-200 font-mono break-all">{display}</span>
      }
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-xs text-gray-600 uppercase tracking-widest font-mono mb-1.5">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

interface ContentProps {
  workflows: WorkflowData[];
  onDrillDown?: (item: JobData, e: React.MouseEvent) => void;
  onClose?: () => void;
}

function OrchestratorContent({ data, workflows, onDrillDown, onClose }: { data: OrchestratorData } & ContentProps) {
  const wf = data.workflow;
  const dispatchInputs = wf.on?.workflow_dispatch?.inputs ?? {};
  return (
    <>
      <Section title="Triggers">
        {data.triggers.map(t => (
          <div key={t} className="text-xs text-blue-300 font-mono">· {t}</div>
        ))}
      </Section>
      {data.calledWorkflows.length > 0 && (
        <Section title="Calls">
          {data.calledWorkflows.map((w, i) => {
            // Build a fake minimal JobData so UsesLink can trigger drill-in
            const matchingJob = Object.entries(wf.jobs ?? {}).find(([, j]) => (j as JobData).uses === w);
            const jobData: JobData | undefined = matchingJob
              ? { ...(matchingJob[1] as JobData), id: matchingJob[0], 'runs-on': '', steps: [] }
              : undefined;
            return (
              <div key={i} className="flex items-center gap-1">
                <span className="text-gray-600 font-mono text-xs">·</span>
                <UsesLink uses={w} workflows={workflows} onDrillDown={onDrillDown} onClose={onClose} jobData={jobData} />
              </div>
            );
          })}
        </Section>
      )}
      {Object.keys(dispatchInputs).length > 0 && (
        <Section title="Dispatch Inputs">
          {Object.entries(dispatchInputs).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
        </Section>
      )}
      {wf.env && Object.keys(wf.env).length > 0 && (
        <Section title="Env">
          {Object.entries(wf.env).map(([k, v]) => <Row key={k} label={k} value={v} />)}
        </Section>
      )}
      {wf.concurrency && <Section title="Concurrency"><Row label="" value={wf.concurrency} /></Section>}
      {wf.permissions && <Section title="Permissions"><Row label="" value={wf.permissions} /></Section>}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function WorkflowContent({ data, workflows: _wf, onDrillDown: _od, onClose: _oc }: { data: WorkflowData } & ContentProps) {
  const callInputs = data.on?.workflow_call?.inputs ?? {};
  const callSecrets = data.on?.workflow_call?.secrets ?? {};
  const dispatchInputs = data.on?.workflow_dispatch?.inputs ?? {};
  const allInputs = { ...callInputs, ...dispatchInputs };
  return (
    <>
      {Object.keys(allInputs).length > 0 && (
        <Section title="Inputs">
          {Object.entries(allInputs).map(([k, v]) => (
            <div key={k} className="mb-1.5">
              <div className="text-xs text-teal-400 font-mono font-semibold">{k}</div>
              <div className="pl-2 space-y-0.5">
                {typeof v === 'object' && v !== null
                  ? Object.entries(v as Record<string, unknown>).map(([ik, iv]) => <Row key={ik} label={ik} value={iv} />)
                  : <Row label="" value={v} />
                }
              </div>
            </div>
          ))}
        </Section>
      )}
      {Object.keys(callSecrets).length > 0 && (
        <Section title="Secrets">
          {Object.entries(callSecrets).map(([k, v]) => <Row key={k} label={k} value={v} />)}
        </Section>
      )}
      {data.env && Object.keys(data.env).length > 0 && (
        <Section title="Env">
          {Object.entries(data.env).map(([k, v]) => <Row key={k} label={k} value={v} />)}
        </Section>
      )}
      {data.permissions && <Section title="Permissions"><Row label="" value={data.permissions} /></Section>}
      {data.defaults && <Section title="Defaults"><Row label="" value={data.defaults} /></Section>}
      {data.concurrency && <Section title="Concurrency"><Row label="" value={data.concurrency} /></Section>}
    </>
  );
}

function JobContent({ data, workflows, onDrillDown, onClose }: { data: JobData } & ContentProps) {
  return (
    <>
      <Section title="Runner">
        <Row label="runs-on" value={data['runs-on']} />
        {data.needs && <Row label="needs" value={data.needs} />}
        {data.if && <Row label="if" value={data.if} />}
        {data['timeout-minutes'] && <Row label="timeout" value={`${data['timeout-minutes']}m`} />}
        {data.environment && <Row label="environment" value={data.environment} />}
        {data.concurrency !== undefined && <Row label="concurrency" value={String(data.concurrency)} />}
      </Section>
      {data.strategy?.matrix && (
        <Section title="Matrix">
          {Object.entries(data.strategy.matrix).map(([k, v]) => (
            <Row key={k} label={k} value={Array.isArray(v) ? v.join(', ') : v} />
          ))}
          {data.strategy['fail-fast'] !== undefined && (
            <Row label="fail-fast" value={String(data.strategy['fail-fast'])} />
          )}
        </Section>
      )}
      {data.permissions && (
        <Section title="Permissions"><Row label="" value={data.permissions} /></Section>
      )}
      {data.outputs && Object.keys(data.outputs).length > 0 && (
        <Section title="Outputs">
          {Object.entries(data.outputs).map(([k, v]) => <Row key={k} label={k} value={v} />)}
        </Section>
      )}
      {data.uses && (
        <Section title="Reusable Workflow">
          <UsesLink uses={data.uses} workflows={workflows} onDrillDown={onDrillDown} onClose={onClose} jobData={data} />
          {data.with && <Row label="with" value={data.with} />}
          {data.secrets && <Row label="secrets" value={data.secrets} />}
        </Section>
      )}
      {data.env && Object.keys(data.env as Record<string,unknown>).length > 0 && (
        <Section title="Env">
          {Object.entries(data.env as Record<string,unknown>).map(([k, v]) => <Row key={k} label={k} value={v} />)}
        </Section>
      )}
    </>
  );
}

function StepContent({ data, workflows }: { data: StepData } & ContentProps) {
  return (
    <>
      {data.uses && (
        <Section title="Action">
          <UsesLink uses={data.uses} workflows={workflows} />
        </Section>
      )}
      {data.run && (
        <Section title="Script">
          <CopyBlock text={data.run} className="text-green-300 bg-black/40 rounded p-2" />
        </Section>
      )}
      {data.if && <Section title="Condition"><Row label="if" value={data.if} /></Section>}
      {data.with && Object.keys(data.with).length > 0 && (
        <Section title="With">
          {Object.entries(data.with).map(([k, v]) => <Row key={k} label={k} value={v} />)}
        </Section>
      )}
      {data.env && Object.keys(data.env).length > 0 && (
        <Section title="Env">
          {Object.entries(data.env).map(([k, v]) => <Row key={k} label={k} value={v} />)}
        </Section>
      )}
      {data['timeout-minutes'] && <Section title="Timeout"><Row label="" value={`${data['timeout-minutes']}m`} /></Section>}
      {data['continue-on-error'] !== undefined && (
        <Section title="continue-on-error"><Row label="" value={data['continue-on-error']} /></Section>
      )}
    </>
  );
}

// ─── Popup positioning ────────────────────────────────────────────────────────

const POPUP_WIDTH = 288; // w-72
const POPUP_MAX_HEIGHT = 480;
const MARGIN = 12;

function computePosition(anchorRect: DOMRect): { top: number; left: number; originX: string } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer right side, fall back to left
  let left = anchorRect.right + MARGIN;
  let originX = '0%';
  if (left + POPUP_WIDTH > vw - MARGIN) {
    left = anchorRect.left - POPUP_WIDTH - MARGIN;
    originX = '100%';
  }
  // Clamp left
  left = Math.max(MARGIN, Math.min(left, vw - POPUP_WIDTH - MARGIN));

  // Align top with card, clamp to viewport
  let top = anchorRect.top;
  top = Math.max(MARGIN, Math.min(top, vh - POPUP_MAX_HEIGHT - MARGIN));

  return { top, left, originX };
}

// ─── Main popup ───────────────────────────────────────────────────────────────

export function CardPopup({ popup, onClose, workflows = [], onDrillDown }: CardPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!popup) return;
    // Use capture phase so this fires before React Flow's own handlers.
    // Skip the very first event (the one that opened the popup).
    let skip = true;
    const handler = (e: PointerEvent) => {
      if (skip) { skip = false; return; }
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handler, { capture: true });
    return () => window.removeEventListener('pointerdown', handler, { capture: true });
  }, [popup, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Move focus to close button when popup opens
  useEffect(() => {
    if (popup) {
      requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
  }, [popup]);

  if (!popup) return null;

  const { top, left, originX } = computePosition(popup.anchorRect);
  const config = levelConfig[popup.level];

  const name =
    'name' in popup.data && popup.data.name
      ? popup.data.name
      : 'filename' in popup.data
      ? (popup.data as OrchestratorData).filename
      : (popup.data as JobData | StepData).id;

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        key="popup"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed',
          top,
          left,
          width: POPUP_WIDTH,
          maxHeight: POPUP_MAX_HEIGHT,
          transformOrigin: `${originX} top`,
          zIndex: 60,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`${popup.level} details: ${name}`}
        className="hud-panel rounded-lg border border-blue-500/20 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-3 py-2 border-b border-blue-500/10 ${config.headerBg} rounded-t-lg shrink-0`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-gray-500 font-mono uppercase tracking-wider">{popup.level}</span>
            <span className={`text-xs font-semibold font-mono truncate ${config.accent}`}>{name}</span>
            {popup.level === 'step' && (popup.data as StepData).run && (
              <Terminal size={10} className="shrink-0 text-amber-500/50" />
            )}
          </div>
          <button ref={closeButtonRef} onClick={onClose} aria-label="Close details" className="shrink-0 text-gray-600 hover:text-gray-300 transition-colors ml-2">
            <X size={13} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-3 scrollbar-thin hud-scanline">
          {popup.level === 'orchestrator' && <OrchestratorContent data={popup.data as OrchestratorData} workflows={workflows} onDrillDown={onDrillDown} onClose={onClose} />}
          {popup.level === 'workflow'     && <WorkflowContent     data={popup.data as WorkflowData} workflows={workflows} onDrillDown={onDrillDown} onClose={onClose} />}
          {popup.level === 'job'          && <JobContent          data={popup.data as JobData} workflows={workflows} onDrillDown={onDrillDown} onClose={onClose} />}
          {popup.level === 'step'         && <StepContent         data={popup.data as StepData} workflows={workflows} onDrillDown={onDrillDown} onClose={onClose} />}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export type { PopupState };
