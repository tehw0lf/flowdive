export type Level = 'orchestrator' | 'workflow' | 'job' | 'step';

export interface WorkflowTrigger {
  push?: { branches?: string[]; tags?: string[] };
  pull_request?: { branches?: string[] };
  workflow_dispatch?: { inputs?: Record<string, WorkflowInput> };
  workflow_call?: { inputs?: Record<string, WorkflowInput>; secrets?: Record<string, { required?: boolean }> };
  schedule?: { cron: string }[];
  [key: string]: unknown;
}

export interface WorkflowInput {
  type?: string;
  description?: string;
  required?: boolean;
  default?: unknown;
}

export interface StepData {
  id: string;
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
  if?: string;
  'continue-on-error'?: boolean;
  'timeout-minutes'?: number;
}

export interface JobData {
  id: string;
  name?: string;
  'runs-on': string | string[];
  needs?: string | string[];
  if?: string;
  'timeout-minutes'?: number;
  permissions?: Record<string, string> | string;
  steps: StepData[];
  strategy?: {
    matrix?: Record<string, unknown>;
    'fail-fast'?: boolean;
  };
  environment?: string | { name: string; url?: string };
  outputs?: Record<string, string>;
  secrets?: string;
  uses?: string;
  with?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WorkflowData {
  id: string;
  filename: string;
  name?: string;
  on: WorkflowTrigger;
  jobs: Record<string, Omit<JobData, 'id'>>;
  env?: Record<string, unknown>;
  permissions?: Record<string, string> | string;
  defaults?: Record<string, unknown>;
  concurrency?: unknown;
  [key: string]: unknown;
}

export interface OrchestratorData {
  id: string;
  filename: string;
  name?: string;
  triggers: string[];
  calledWorkflows: string[];
  workflow: WorkflowData;
}

export interface BreadcrumbItem {
  level: Level;
  label: string;
  orchestratorId?: string;
  workflowId?: string;
  jobId?: string;
}

export interface DrillState {
  level: Level;
  orchestratorId?: string;
  workflowId?: string;
  jobId?: string;
  clickOrigin?: { x: number; y: number };
}
