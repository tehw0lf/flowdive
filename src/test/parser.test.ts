import { describe, it, expect } from 'vitest';
import {
  parseWorkflowYaml,
  getJobsFromWorkflow,
  getStepsFromJob,
  resolveUsesRef,
} from '../parser';

// ─── parseWorkflowYaml ────────────────────────────────────────────────────────

describe('parseWorkflowYaml', () => {
  it('parses a minimal workflow', () => {
    const yaml = `
name: CI
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`;
    const result = parseWorkflowYaml('ci.yml', yaml);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('ci.yml');
    expect(result!.filename).toBe('ci.yml');
    expect(result!.name).toBe('CI');
    expect(result!.on.push).toBeDefined();
    expect(Object.keys(result!.jobs)).toContain('build');
  });

  it('returns null for invalid YAML', () => {
    expect(parseWorkflowYaml('bad.yml', ': : :')).toBeNull();
  });

  it('returns null for empty content', () => {
    expect(parseWorkflowYaml('empty.yml', '')).toBeNull();
  });

  it('handles workflow_call trigger', () => {
    const yaml = `
on:
  workflow_call:
    inputs:
      env:
        type: string
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps: []
`;
    const result = parseWorkflowYaml('reusable.yml', yaml);
    expect(result).not.toBeNull();
    expect(result!.on.workflow_call?.inputs?.env?.type).toBe('string');
  });
});

// ─── getJobsFromWorkflow ──────────────────────────────────────────────────────

describe('getJobsFromWorkflow', () => {
  const yaml = `
name: Multi-job
on: [push]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint
  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - run: npm test
`;

  it('returns all jobs with ids', () => {
    const wf = parseWorkflowYaml('multi.yml', yaml)!;
    const jobs = getJobsFromWorkflow(wf);
    expect(jobs).toHaveLength(2);
    expect(jobs.map(j => j.id)).toEqual(expect.arrayContaining(['lint', 'test']));
  });

  it('preserves needs field', () => {
    const wf = parseWorkflowYaml('multi.yml', yaml)!;
    const jobs = getJobsFromWorkflow(wf);
    const test = jobs.find(j => j.id === 'test');
    expect(test?.needs).toBe('lint');
  });

  it('returns empty array for workflow with no jobs', () => {
    const wf = parseWorkflowYaml('empty.yml', 'on: [push]\njobs: {}')!;
    expect(getJobsFromWorkflow(wf)).toHaveLength(0);
  });
});

// ─── getStepsFromJob ──────────────────────────────────────────────────────────

describe('getStepsFromJob', () => {
  it('returns steps with generated ids', () => {
    const yaml = `
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install
        run: npm install
      - id: my-step
        run: npm test
`;
    const wf = parseWorkflowYaml('build.yml', yaml)!;
    const jobs = getJobsFromWorkflow(wf);
    const steps = getStepsFromJob(jobs[0]);
    expect(steps).toHaveLength(3);
    expect(steps[0].id).toBe('0');
    expect(steps[1].id).toBe('1');
    expect(steps[2].id).toBe('my-step');
  });

  it('generates name from uses: when name is missing', () => {
    const yaml = `
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`;
    const wf = parseWorkflowYaml('build.yml', yaml)!;
    const steps = getStepsFromJob(getJobsFromWorkflow(wf)[0]);
    expect(steps[0].name).toBe('uses: actions/checkout@v4');
  });
});

// ─── resolveUsesRef ───────────────────────────────────────────────────────────

describe('resolveUsesRef', () => {
  const workflows = [
    { id: 'reusable.yml', filename: 'reusable.yml' },
    { id: 'deploy.yml', filename: 'deploy.yml' },
  ] as Parameters<typeof resolveUsesRef>[1];

  it('resolves local ref by filename', () => {
    const result = resolveUsesRef('./.github/workflows/reusable.yml', workflows);
    expect(result?.id).toBe('reusable.yml');
  });

  it('resolves local ref with @ref suffix', () => {
    const result = resolveUsesRef('./.github/workflows/reusable.yml@main', workflows);
    expect(result?.id).toBe('reusable.yml');
  });

  it('resolves external ref by filename segment', () => {
    const result = resolveUsesRef('org/repo/.github/workflows/deploy.yml@v1', workflows);
    expect(result?.id).toBe('deploy.yml');
  });

  it('returns null for unresolvable ref', () => {
    const result = resolveUsesRef('org/repo/.github/workflows/unknown.yml@main', workflows);
    expect(result).toBeNull();
  });

  it('returns null for action refs (no path segments matching)', () => {
    const result = resolveUsesRef('actions/checkout@v4', workflows);
    expect(result).toBeNull();
  });
});
