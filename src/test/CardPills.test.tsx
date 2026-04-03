import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Pill,
  OrchestratorPills,
  WorkflowPills,
  JobPills,
  StepPills,
  resolveCardName,
  levelConfig,
} from '../components/CardPills';
import type { OrchestratorData, WorkflowData, JobData, StepData } from '../types';

const cfg = levelConfig.orchestrator;

// ─── Pill ─────────────────────────────────────────────────────────────────────

describe('Pill', () => {
  it('renders label', () => {
    render(<Pill label="push" className="test" />);
    expect(screen.getByText('push')).toBeInTheDocument();
  });

  it('renders label + value', () => {
    render(<Pill label="calls" value="3" className="test" />);
    expect(screen.getByText('calls')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

// ─── OrchestratorPills ────────────────────────────────────────────────────────

describe('OrchestratorPills', () => {
  const data: OrchestratorData = {
    id: 'orc.yml',
    filename: 'orc.yml',
    triggers: ['push', 'pull_request'],
    calledWorkflows: ['deploy.yml', 'test.yml'],
    workflow: { id: 'orc.yml', filename: 'orc.yml', on: {}, jobs: {} },
  };

  it('renders trigger pills', () => {
    render(<OrchestratorPills data={data} config={cfg} />);
    expect(screen.getByText('push')).toBeInTheDocument();
    expect(screen.getByText('pull_request')).toBeInTheDocument();
  });

  it('renders calls count pill', () => {
    render(<OrchestratorPills data={data} config={cfg} />);
    expect(screen.getByText('calls')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

// ─── WorkflowPills ────────────────────────────────────────────────────────────

describe('WorkflowPills', () => {
  const data: WorkflowData = {
    id: 'wf.yml',
    filename: 'wf.yml',
    on: { workflow_call: { inputs: { env: { type: 'string' }, region: { type: 'string' } } } },
    jobs: { build: { id: 'build', 'runs-on': 'ubuntu-latest', steps: [] } as JobData },
  };

  it('renders job count', () => {
    render(<WorkflowPills data={data} config={levelConfig.workflow} />);
    expect(screen.getByText('jobs')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders inputs count', () => {
    render(<WorkflowPills data={data} config={levelConfig.workflow} />);
    expect(screen.getByText('inputs')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

// ─── JobPills ─────────────────────────────────────────────────────────────────

describe('JobPills', () => {
  const data: JobData = {
    id: 'test',
    'runs-on': 'ubuntu-latest',
    needs: ['lint', 'build'],
    steps: [{ id: '0', uses: 'actions/checkout@v4' }, { id: '1', run: 'npm test' }],
  };

  it('renders runs-on pill', () => {
    render(<JobPills data={data} config={levelConfig.job} />);
    expect(screen.getByText('ubuntu-latest')).toBeInTheDocument();
  });

  it('renders needs pills', () => {
    render(<JobPills data={data} config={levelConfig.job} />);
    expect(screen.getAllByText('needs')).toHaveLength(2);
    expect(screen.getByText('lint')).toBeInTheDocument();
    expect(screen.getByText('build')).toBeInTheDocument();
  });

  it('renders step count', () => {
    render(<JobPills data={data} config={levelConfig.job} />);
    expect(screen.getByText('steps')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders environment pill', () => {
    const withEnv: JobData = { ...data, environment: 'production' };
    render(<JobPills data={withEnv} config={levelConfig.job} />);
    expect(screen.getByText('env')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
  });

  it('renders environment pill from object form', () => {
    const withEnv: JobData = { ...data, environment: { name: 'staging', url: 'https://staging.example.com' } };
    render(<JobPills data={withEnv} config={levelConfig.job} />);
    expect(screen.getByText('env')).toBeInTheDocument();
    expect(screen.getByText('staging')).toBeInTheDocument();
  });

  it('renders matrix pill with combination count', () => {
    const withMatrix: JobData = {
      ...data,
      strategy: { matrix: { os: ['ubuntu-latest', 'windows-latest'], node: ['18', '20'] } },
    };
    render(<JobPills data={withMatrix} config={levelConfig.job} />);
    expect(screen.getByText('matrix')).toBeInTheDocument();
    expect(screen.getByText('×4')).toBeInTheDocument();
  });
});

// ─── StepPills ────────────────────────────────────────────────────────────────

describe('StepPills', () => {
  it('renders uses pill', () => {
    const data: StepData = { id: '0', uses: 'actions/checkout@v4' };
    render(<StepPills data={data} config={levelConfig.step} />);
    expect(screen.getByText('actions/checkout')).toBeInTheDocument();
  });

  it('renders run pill', () => {
    const data: StepData = { id: '0', run: 'npm test' };
    render(<StepPills data={data} config={levelConfig.step} />);
    expect(screen.getByText('run')).toBeInTheDocument();
  });

  it('renders with count', () => {
    const data: StepData = { id: '0', run: 'echo hi', with: { key1: 'a', key2: 'b' } };
    render(<StepPills data={data} config={levelConfig.step} />);
    expect(screen.getByText('with')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

// ─── resolveCardName ──────────────────────────────────────────────────────────

describe('resolveCardName', () => {
  it('returns name if present', () => {
    const data = { id: 'id', filename: 'file.yml', name: 'My Workflow', on: {}, jobs: {} } as WorkflowData;
    expect(resolveCardName('workflow', data)).toBe('My Workflow');
  });

  it('falls back to filename for orchestrator without name', () => {
    const data: OrchestratorData = {
      id: 'orc.yml', filename: 'orc.yml', triggers: [], calledWorkflows: [],
      workflow: { id: 'orc.yml', filename: 'orc.yml', on: {}, jobs: {} },
    };
    expect(resolveCardName('orchestrator', data)).toBe('orc.yml');
  });

  it('falls back to id for job without name', () => {
    const data: JobData = { id: 'build-job', 'runs-on': 'ubuntu-latest', steps: [] };
    expect(resolveCardName('job', data)).toBe('build-job');
  });
});
