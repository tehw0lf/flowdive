import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardPopup } from '../components/CardPopup';
import type { OrchestratorData, WorkflowData, JobData, StepData } from '../types';

// Framer Motion: render children immediately without animations
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      ...actual.motion,
      div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    },
  };
});

const anchorRect = {
  top: 100, left: 100, right: 200, bottom: 150,
  width: 100, height: 50, x: 100, y: 100,
  toJSON: () => ({}),
} as DOMRect;

function makePopup(level: 'orchestrator' | 'workflow' | 'job' | 'step', data: OrchestratorData | WorkflowData | JobData | StepData) {
  return { data, level, anchorRect };
}

// ─── Render / close ───────────────────────────────────────────────────────────

describe('CardPopup', () => {
  it('renders nothing when popup is null', () => {
    const { container } = render(<CardPopup popup={null} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders popup with level label', () => {
    const data: JobData = { id: 'build', 'runs-on': 'ubuntu-latest', steps: [], name: 'Build' };
    render(<CardPopup popup={makePopup('job', data)} onClose={vi.fn()} />);
    expect(screen.getByText('job')).toBeInTheDocument();
    expect(screen.getByText('Build')).toBeInTheDocument();
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn();
    const data: JobData = { id: 'build', 'runs-on': 'ubuntu-latest', steps: [] };
    render(<CardPopup popup={makePopup('job', data)} onClose={onClose} />);
    const buttons = document.querySelectorAll('button');
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    const data: JobData = { id: 'build', 'runs-on': 'ubuntu-latest', steps: [] };
    render(<CardPopup popup={makePopup('job', data)} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

// ─── Orchestrator content ─────────────────────────────────────────────────────

describe('CardPopup — orchestrator', () => {
  const data: OrchestratorData = {
    id: 'orc.yml',
    filename: 'orc.yml',
    name: 'CI Orchestrator',
    triggers: ['push', 'workflow_dispatch'],
    calledWorkflows: ['deploy.yml'],
    workflow: { id: 'orc.yml', filename: 'orc.yml', on: {}, jobs: {} },
  };

  it('renders trigger list', () => {
    render(<CardPopup popup={makePopup('orchestrator', data)} onClose={vi.fn()} />);
    expect(screen.getByText('· push')).toBeInTheDocument();
    expect(screen.getByText('· workflow_dispatch')).toBeInTheDocument();
  });

  it('renders called workflow as link', () => {
    render(<CardPopup popup={makePopup('orchestrator', data)} onClose={vi.fn()} workflows={[]} />);
    expect(screen.getByText('deploy.yml')).toBeInTheDocument();
  });
});

// ─── Job content ──────────────────────────────────────────────────────────────

describe('CardPopup — job', () => {
  const data: JobData = {
    id: 'test',
    name: 'Run Tests',
    'runs-on': 'ubuntu-latest',
    needs: 'lint',
    steps: [],
    'timeout-minutes': 30,
  };

  it('renders runs-on', () => {
    render(<CardPopup popup={makePopup('job', data)} onClose={vi.fn()} />);
    expect(screen.getByText('ubuntu-latest')).toBeInTheDocument();
  });

  it('renders needs', () => {
    render(<CardPopup popup={makePopup('job', data)} onClose={vi.fn()} />);
    expect(screen.getByText('lint')).toBeInTheDocument();
  });

  it('renders timeout', () => {
    render(<CardPopup popup={makePopup('job', data)} onClose={vi.fn()} />);
    expect(screen.getByText('30m')).toBeInTheDocument();
  });

  it('renders uses: as external link when not locally loaded', () => {
    const jobWithUses: JobData = { ...data, uses: 'org/repo/.github/workflows/deploy.yml@main' };
    render(<CardPopup popup={makePopup('job', jobWithUses)} onClose={vi.fn()} workflows={[]} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('github.com'));
  });

  it('renders uses: as drill-in button when locally loaded', () => {
    const reusable: WorkflowData = { id: 'deploy.yml', filename: 'deploy.yml', on: {}, jobs: {} };
    const jobWithUses: JobData = { ...data, uses: './.github/workflows/deploy.yml' };
    const onDrillDown = vi.fn();
    render(
      <CardPopup
        popup={makePopup('job', jobWithUses)}
        onClose={vi.fn()}
        workflows={[reusable]}
        onDrillDown={onDrillDown}
      />
    );
    const drillBtn = screen.getByTitle(/Drill into/i);
    fireEvent.click(drillBtn);
    expect(onDrillDown).toHaveBeenCalled();
  });
});

// ─── Step content ─────────────────────────────────────────────────────────────

describe('CardPopup — step', () => {
  it('renders uses: as github link', () => {
    const data: StepData = { id: '0', name: 'Checkout', uses: 'actions/checkout@v4' };
    render(<CardPopup popup={makePopup('step', data)} onClose={vi.fn()} workflows={[]} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://github.com/actions/checkout/tree/v4');
    expect(link).toHaveTextContent('actions/checkout@v4');
  });

  it('renders run script in pre block', () => {
    const data: StepData = { id: '0', name: 'Build', run: 'npm run build' };
    render(<CardPopup popup={makePopup('step', data)} onClose={vi.fn()} />);
    expect(screen.getByText('npm run build')).toBeInTheDocument();
  });
});

// ─── Copy button ──────────────────────────────────────────────────────────────

describe('CardPopup — copy button', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('copy button calls clipboard.writeText with script content', async () => {
    const data: StepData = { id: '0', name: 'Build', run: 'npm run build' };
    render(<CardPopup popup={makePopup('step', data)} onClose={vi.fn()} />);
    const copyBtn = screen.getByTitle('Copy to clipboard');
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('npm run build');
  });
});
