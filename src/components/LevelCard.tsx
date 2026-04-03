import { motion } from 'framer-motion';
import type { Level, OrchestratorData, WorkflowData, JobData, StepData } from '../types';
import { Workflow, ChevronsRight, ExternalLink, Terminal } from 'lucide-react';
import {
  levelConfig,
  resolveCardName,
  OrchestratorPills,
  WorkflowPills,
  JobPills,
  StepPills,
} from './CardPills';
import { useTilt } from '../hooks/useTilt';

// eslint-disable-next-line react-refresh/only-export-components
export { levelConfig };
export type { LevelConfig } from './CardPills';

// ─── Card component ───────────────────────────────────────────────────────────

interface CardProps {
  level: Level;
  data: OrchestratorData | WorkflowData | JobData | StepData;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDrillDown?: (e: React.MouseEvent) => void;
  drillsIntoWorkflow?: boolean;
  usesUnresolved?: boolean;
  index: number;
  effectsEnabled?: boolean;
}

export function LevelCard({ level, data, isSelected, onSelect, onDrillDown, drillsIntoWorkflow, usesUnresolved, index, effectsEnabled = true }: CardProps) {
  const config = levelConfig[level];
  const effectiveConfig = (level === 'job' && drillsIntoWorkflow) ? levelConfig.workflow : config;
  const Icon = drillsIntoWorkflow ? Workflow : config.icon;
  const name = resolveCardName(level, data);

  const ringColor =
    level === 'orchestrator' ? 'ring-blue-400/50'
    : level === 'workflow' ? 'ring-teal-400/50'
    : level === 'job' ? (drillsIntoWorkflow ? 'ring-teal-400/50' : 'ring-green-400/50')
    : 'ring-amber-400/50';

  const canShowStrip = config.canDrillDown && onDrillDown && !usesUnresolved;

  const isReusableOnly = level === 'orchestrator'
    && (data as OrchestratorData).calledWorkflows.length === 0;

  const tilt = useTilt();

  /* eslint-disable react-hooks/refs */
  return (
    <motion.div
      ref={tilt.ref}
      initial={effectsEnabled ? { opacity: 0, y: 16, scale: 0.96 } : false}
      animate={{ opacity: isReusableOnly ? 0.55 : 1, y: 0, scale: 1 }}
      exit={effectsEnabled ? { opacity: 0, scale: 0.92 } : undefined}
      transition={effectsEnabled ? { delay: index * 0.04, duration: 0.25 } : { duration: 0 }}
      whileHover={{ opacity: 1 }}
      onMouseMove={effectsEnabled ? tilt.onMouseMove : undefined}
      onMouseLeave={effectsEnabled ? tilt.onMouseLeave : undefined}
      style={effectsEnabled ? { rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: 800 } : {}}
      className={`
        relative rounded-lg border overflow-hidden transition-all duration-150 flex
        ${effectiveConfig.border} ${effectiveConfig.bg} ${effectiveConfig.glow}
        ${isSelected ? `ring-2 ${ringColor}` : ''}
        hover:scale-[1.015] w-full
      `}
    >
      {/* Main card area */}
      <div
        className="flex-1 min-w-0 cursor-pointer select-none"
        role="button"
        tabIndex={0}
        aria-label={`View details for ${name}`}
        onClick={onSelect}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(e as unknown as React.MouseEvent); } }}
      >

        {/* Header row */}
        <div className={`${effectiveConfig.headerBg} px-3 py-1.5 border-b ${effectiveConfig.border} flex items-center gap-2`}>
          <Icon size={12} className={effectiveConfig.accent} />
          <span className={`text-xs font-semibold font-mono truncate ${effectiveConfig.accent}`}>
            {name}
          </span>
          {usesUnresolved && (
            <span className="ml-auto shrink-0 flex items-center gap-1 text-xs text-gray-600 font-mono">
              <ExternalLink size={10} />
            </span>
          )}
          {level === 'step' && (data as StepData).run && (
            <Terminal size={10} className="ml-auto text-amber-500/50 shrink-0" />
          )}
        </div>

        {/* Pills row */}
        <div className="px-3 py-2 flex flex-wrap gap-1">
          {level === 'orchestrator' && <OrchestratorPills data={data as OrchestratorData} config={effectiveConfig} />}
          {level === 'workflow'     && <WorkflowPills     data={data as WorkflowData}     config={effectiveConfig} />}
          {level === 'job'          && <JobPills          data={data as JobData}           config={effectiveConfig} drillsIntoWorkflow={drillsIntoWorkflow} />}
          {level === 'step'         && <StepPills         data={data as StepData}          config={effectiveConfig} />}
        </div>
      </div>

      {/* Drill-down strip */}
      {canShowStrip && (
        <button
          onClick={onDrillDown}
          title={drillsIntoWorkflow ? 'Open reusable workflow' : 'Drill into'}
          aria-label={drillsIntoWorkflow ? `Open reusable workflow ${name}` : `Drill into ${name}`}
          className={`
            shrink-0 w-14 flex flex-col items-center justify-center
            border-l transition-all duration-150 group
            ${effectiveConfig.stripColors}
          `}
        >
          <ChevronsRight
            size={12}
            aria-hidden="true"
            className="transition-transform duration-150 group-hover:translate-x-0.5"
          />
        </button>
      )}
    </motion.div>
  );
  /* eslint-enable react-hooks/refs */
}
