import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { CardPopup } from '../components/CardPopup';
import { LevelCard } from '../components/LevelCard';
import App from '../App';
import type { JobData, StepData } from '../types';

// ─── Mocks (same as navigation tests) ────────────────────────────────────────

const CI_YAML = vi.hoisted(() => `
name: CI Pipeline
on: [push]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - name: Lint
        run: npm run lint
`);

vi.mock('../components/YamlLoader', () => ({
  YamlLoader: ({ onLoad }: { onLoad: (f: { name: string; content: string }[]) => void }) => (
    <button data-testid="load-btn" onClick={() => onLoad([{ name: 'ci.yml', content: CI_YAML }])}>Load</button>
  ),
}));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: new Proxy({}, {
      get: () => ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => <div {...props}>{children}</div>,
    }),
  };
});

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  useReactFlow: () => ({ fitView: vi.fn() }),
  addEdge: vi.fn(),
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom' },
  Background: () => null, Controls: () => null, MiniMap: () => null,
}));

const anchorRect = {
  top: 100, left: 100, right: 300, bottom: 150,
  width: 200, height: 50, x: 100, y: 100,
  toJSON: () => ({}),
} as DOMRect;

// ─── CardPopup ARIA ───────────────────────────────────────────────────────────

describe('CardPopup accessibility', () => {
  const data: JobData = { id: 'build', name: 'Build', 'runs-on': 'ubuntu-latest', steps: [] };
  const popup = { data, level: 'job' as const, anchorRect };

  it('has role=dialog', () => {
    render(<CardPopup popup={popup} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has aria-modal=true', () => {
    render(<CardPopup popup={popup} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('has descriptive aria-label', () => {
    render(<CardPopup popup={popup} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'job details: Build');
  });

  it('close button has aria-label', () => {
    render(<CardPopup popup={popup} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Close details' })).toBeInTheDocument();
  });

  it('copy button has aria-label', () => {
    const stepData: StepData = { id: '0', name: 'Build', run: 'npm run build' };
    render(<CardPopup popup={{ data: stepData, level: 'step', anchorRect }} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeInTheDocument();
  });

  it('focuses close button on open', async () => {
    render(<CardPopup popup={popup} onClose={vi.fn()} />);
    // rAF needed for focus
    await new Promise(r => setTimeout(r, 50));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close details' }));
  });
});

// ─── LevelCard ARIA ───────────────────────────────────────────────────────────

describe('LevelCard accessibility', () => {
  const data: JobData = { id: 'build', name: 'Build Job', 'runs-on': 'ubuntu-latest', steps: [] };

  it('card area has role=button and aria-label', () => {
    render(
      <LevelCard level="job" data={data} isSelected={false} onSelect={vi.fn()} index={0} />
    );
    expect(screen.getByRole('button', { name: 'View details for Build Job' })).toBeInTheDocument();
  });

  it('drill button has descriptive aria-label', () => {
    render(
      <LevelCard level="job" data={data} isSelected={false} onSelect={vi.fn()} onDrillDown={vi.fn()} index={0} />
    );
    expect(screen.getByRole('button', { name: 'Drill into Build Job' })).toBeInTheDocument();
  });

  it('card area is keyboard activatable with Enter', () => {
    const onSelect = vi.fn();
    render(
      <LevelCard level="job" data={data} isSelected={false} onSelect={onSelect} index={0} />
    );
    const btn = screen.getByRole('button', { name: 'View details for Build Job' });
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalled();
  });

  it('card area is keyboard activatable with Space', () => {
    const onSelect = vi.fn();
    render(
      <LevelCard level="job" data={data} isSelected={false} onSelect={onSelect} index={0} />
    );
    const btn = screen.getByRole('button', { name: 'View details for Build Job' });
    fireEvent.keyDown(btn, { key: ' ' });
    expect(onSelect).toHaveBeenCalled();
  });
});

// ─── View + Effects toggles ───────────────────────────────────────────────────

describe('App toolbar accessibility', () => {
  async function renderLoaded() {
    render(<App />);
    await act(async () => { fireEvent.click(screen.getByTestId('load-btn')); });
    fireEvent.click(screen.getByTitle('Grid view'));
    await screen.findByText('CI Pipeline');
  }

  it('grid view button has aria-pressed', async () => {
    await renderLoaded();
    const btn = screen.getByRole('button', { name: 'Switch to grid view' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('graph view button has aria-pressed=false when grid active', async () => {
    await renderLoaded();
    const btn = screen.getByRole('button', { name: 'Switch to graph view' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('effects button has aria-pressed and aria-label', async () => {
    await renderLoaded();
    const btn = screen.getByRole('button', { name: /Toggle visual effects/ });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('effects button aria-pressed toggles on click', async () => {
    await renderLoaded();
    const btn = screen.getByRole('button', { name: /Toggle visual effects/ });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ─── aria-live region ─────────────────────────────────────────────────────────

describe('aria-live level announcements', () => {
  it('announces current level to screen readers', async () => {
    render(<App />);
    await act(async () => { fireEvent.click(screen.getByTestId('load-btn')); });
    const live = document.querySelector('[aria-live="polite"]');
    expect(live).toBeInTheDocument();
    expect(live?.textContent).toContain('orchestrator');
  });

  it('updates announcement after drill', async () => {
    render(<App />);
    await act(async () => { fireEvent.click(screen.getByTestId('load-btn')); });
    fireEvent.click(screen.getByTitle('Grid view'));
    await screen.findByText('CI Pipeline');
    fireEvent.click(screen.getByRole('button', { name: 'Drill into CI Pipeline' }));
    const live = document.querySelector('[aria-live="polite"]');
    await waitFor(() => expect(live?.textContent).toContain('job'));
  });
});
