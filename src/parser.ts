import * as yaml from 'js-yaml';
import type { WorkflowData, OrchestratorData, JobData, StepData } from './types';

function extractTriggers(on: WorkflowData['on']): string[] {
  if (!on) return [];
  return Object.keys(on);
}

function isOrchestrator(workflow: WorkflowData): boolean {
  return Object.values(workflow.jobs ?? {}).some(job => !!(job as JobData).uses);
}

function extractCalledWorkflows(workflow: WorkflowData): string[] {
  const called: string[] = [];
  for (const job of Object.values(workflow.jobs || {})) {
    const j = job as JobData;
    if (j.uses) {
      called.push(j.uses);
    }
  }
  return called;
}

export function parseWorkflowYaml(filename: string, content: string): WorkflowData | null {
  try {
    const parsed = yaml.load(content) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;

    // Normalize 'on' key (js-yaml may parse 'on' as true in some edge cases)
    const onKey = parsed['on'] ?? parsed['true'];

    return {
      ...parsed,
      id: filename,
      filename,
      name: parsed['name'] as string | undefined,
      on: (onKey ?? {}) as WorkflowData['on'],
      jobs: (parsed['jobs'] ?? {}) as WorkflowData['jobs'],
    };
  } catch {
    return null;
  }
}

export function buildOrchestratorData(workflows: WorkflowData[]): OrchestratorData[] {
  return workflows
    .filter(isOrchestrator)
    .map(w => ({
      id: w.id,
      filename: w.filename,
      name: w.name,
      triggers: extractTriggers(w.on),
      calledWorkflows: extractCalledWorkflows(w),
      workflow: w,
    }));
}

export function getJobsFromWorkflow(workflow: WorkflowData): JobData[] {
  return Object.entries(workflow.jobs || {}).map(([id, job]) => {
    const j = job as JobData;
    return {
      ...j,
      id,
      name: j.name ?? id,
      'runs-on': j['runs-on'] ?? 'ubuntu-latest',
      steps: (j.steps ?? []).map((s, i) => ({
        ...s,
        id: s.id ?? String(i),
      })),
    };
  });
}

export function getStepsFromJob(job: JobData): StepData[] {
  return (job.steps ?? []).map((s, i) => ({
    ...s,
    id: s.id ?? String(i),
    name: s.name ?? (s.uses ? `uses: ${s.uses}` : s.run ? `run: ${s.run.split('\n')[0]}` : `Step ${i + 1}`),
  }));
}

export function parseMultipleFiles(files: { name: string; content: string }[]): {
  workflows: WorkflowData[];
  orchestrators: OrchestratorData[];
} {
  const workflows: WorkflowData[] = [];
  for (const { name, content } of files) {
    const parsed = parseWorkflowYaml(name, content);
    if (parsed) workflows.push(parsed);
  }
  return { workflows, orchestrators: buildOrchestratorData(workflows) };
}

/**
 * Resolve a job's `uses:` reference to a loaded WorkflowData, if available.
 *
 * Handles:
 *   - Local refs:    ./.github/workflows/reusable.yml
 *                   ./.github/workflows/reusable.yml@main  (ref stripped)
 *   - External refs: org/repo/.github/workflows/file.yml@ref
 *                   (matched by filename part only as fallback)
 */
export function resolveUsesRef(uses: string, workflows: WorkflowData[]): WorkflowData | null {
  // Strip @ref suffix
  const withoutRef = uses.replace(/@[^@]*$/, '');

  // Extract just the filename (last path segment)
  const filename = withoutRef.split('/').at(-1) ?? withoutRef;

  // 1. Try exact id match (e.g. the user loaded the file with the same name)
  const exact = workflows.find(w => w.id === filename || w.id === withoutRef);
  if (exact) return exact;

  // 2. Try matching by filename suffix – handles cases where files were loaded
  //    with a bare name like "reusable.yml" but referenced as "./.github/workflows/reusable.yml"
  const bySuffix = workflows.find(w => w.filename === filename || w.filename.endsWith('/' + filename));
  if (bySuffix) return bySuffix;

  return null;
}
