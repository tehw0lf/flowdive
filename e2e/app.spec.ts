import { test, expect, Page } from '@playwright/test';

// ─── YAML fixtures ────────────────────────────────────────────────────────────

const CI_YAML = `
name: CI Pipeline
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Lint
        run: npm run lint
  test:
    runs-on: ubuntu-latest
    needs: lint
    environment: production
    steps:
      - name: Test
        run: npm test
  deploy:
    runs-on: ubuntu-latest
    needs: [lint, test]
    strategy:
      matrix:
        region: [us-east-1, eu-west-1]
    steps:
      - name: Deploy
        run: ./deploy.sh
`.trim();

const DISPATCH_YAML = `
name: Manual Deploy
on:
  workflow_dispatch:
    inputs:
      environment:
        type: string
        required: true
        description: Target environment
      version:
        type: string
        default: latest
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: echo deploy
`.trim();

// Reusable workflow — called by ORCHESTRATOR_YAML
const REUSABLE_YAML = `
name: Reusable Build
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        required: false
    secrets:
      NPM_TOKEN:
        required: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Build
        run: npm run build
        env:
          NODE_ENV: production
`.trim();

// Orchestrator that calls the reusable workflow
const ORCHESTRATOR_YAML = `
name: Main Orchestrator
on: [push]
jobs:
  call-build:
    uses: ./.github/workflows/reusable.yml
    with:
      node-version: "20"
    secrets:
      NPM_TOKEN: \${{ secrets.NPM_TOKEN }}
`.trim();

// Workflow with detailed step properties (env, with, if, continue-on-error, timeout)
const STEPS_YAML = `
name: Steps Demo
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Build
        run: |
          npm ci
          npm run build
        env:
          NODE_ENV: production
        timeout-minutes: 10
      - name: Conditional step
        run: echo "conditional"
        if: github.event_name == 'push'
        continue-on-error: true
`.trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loadYaml(page: Page, filename: string, content: string) {
  await page.getByRole('button', { name: /PASTE/i }).click();
  await page.getByRole('textbox', { name: /Filename/i }).fill(filename);
  const textarea = page.locator('textarea');
  await textarea.fill(content);
  await page.getByRole('button', { name: /PARSE/i }).click();
}

async function switchToGrid(page: Page) {
  await page.getByTitle('Grid view').click();
}

async function loadYamlViaOverlay(page: Page, content: string, filename?: string) {
  await page.getByRole('button', { name: /LOAD FILES|FILES/i }).first().click();
  await page.getByRole('button', { name: /PASTE/i }).last().click();
  if (filename) {
    await page.getByRole('textbox', { name: /Filename/i }).last().fill(filename);
  }
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible({ timeout: 5000 });
  await textarea.fill(content);
  await page.getByRole('button', { name: /PARSE/i }).last().click();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('App loads', () => {
  test('shows file loader on first visit', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/drop.*yaml/i).or(page.getByText(/load/i))).toBeVisible();
  });
});

test.describe('Workflow loading and navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'ci.yml', CI_YAML);
  });

  test('shows orchestrator card after load', async ({ page }) => {
    await switchToGrid(page);
    await expect(page.getByText('CI Pipeline')).toBeVisible();
  });

  test('drills into jobs on drill-down click', async ({ page }) => {
    await switchToGrid(page);
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await expect(page.getByRole('button', { name: 'View details for lint' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'View details for test' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View details for deploy' })).toBeVisible();
  });

  test('shows needs edges as pills', async ({ page }) => {
    await switchToGrid(page);
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await expect(page.getByRole('button', { name: 'View details for test' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('span').filter({ hasText: 'needs' }).first()).toBeVisible();
  });

  test('shows environment pill on job card', async ({ page }) => {
    await switchToGrid(page);
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await expect(page.getByRole('button', { name: 'View details for test' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('production')).toBeVisible();
  });

  test('shows matrix pill with combination count', async ({ page }) => {
    await switchToGrid(page);
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await expect(page.getByRole('button', { name: 'View details for deploy' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('×2')).toBeVisible();
  });

  test('breadcrumb shows after drill', async ({ page }) => {
    await switchToGrid(page);
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await expect(page.getByRole('button', { name: 'View details for lint' })).toBeVisible({ timeout: 5000 });
    // CI Pipeline should appear in breadcrumb
    await expect(page.getByRole('button', { name: /CI Pipeline/ })).toBeVisible();
  });

  test('navigates back via breadcrumb root click', async ({ page }) => {
    await switchToGrid(page);
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await page.waitForTimeout(300);
    // Click root breadcrumb (first item — HOME / orchestrator)
    await page.locator('nav').getByRole('button').first().click();
    await expect(page.getByRole('button', { name: 'Drill into CI Pipeline' })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('CardPopup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'ci.yml', CI_YAML);
    await switchToGrid(page);
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await page.waitForTimeout(300);
  });

  test('opens popup on card click', async ({ page }) => {
    await page.getByRole('button', { name: 'View details for lint' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('popup shows runs-on', async ({ page }) => {
    await page.getByRole('button', { name: 'View details for test' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('runs-on')).toBeVisible();
    await expect(dialog.getByText('ubuntu-latest')).toBeVisible();
  });

  test('popup shows environment', async ({ page }) => {
    await page.getByRole('button', { name: 'View details for test' }).click();
    await expect(page.getByRole('dialog').getByText('production')).toBeVisible();
  });

  test('popup shows matrix details', async ({ page }) => {
    await page.getByRole('button', { name: 'View details for deploy' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Matrix', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/us-east-1/)).toBeVisible();
  });

  test('closes popup with Escape', async ({ page }) => {
    await page.getByRole('button', { name: 'View details for lint' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('close button closes popup', async ({ page }) => {
    await page.getByRole('button', { name: 'View details for lint' }).click();
    await page.getByRole('button', { name: 'Close details' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

test.describe('workflow_dispatch inputs', () => {
  test('popup shows dispatch input details', async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'deploy.yml', DISPATCH_YAML);
    await switchToGrid(page);
    // Drill into the workflow to reach the workflow level
    await page.getByRole('button', { name: 'Drill into Manual Deploy' }).click();
    await page.waitForTimeout(300);
    // Go back to orchestrator and open the popup directly at orchestrator level
    await page.locator('nav').getByRole('button').first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'View details for Manual Deploy' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Dispatch Inputs')).toBeVisible();
    // 'environment' appears as an input name label
    await expect(dialog.locator('span.font-mono.shrink-0', { hasText: 'environment' })).toBeVisible();
  });
});

test.describe('URL state', () => {
  test('URL updates to job level after drill', async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'ci.yml', CI_YAML);
    await switchToGrid(page);
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await page.waitForTimeout(400);
    const url = page.url();
    expect(url).toContain('level=job');
  });

  test('URL contains orchestratorId after drill', async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'ci.yml', CI_YAML);
    await switchToGrid(page);
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await page.waitForTimeout(400);
    const url = page.url();
    expect(url).toContain('orc=');
  });
});

test.describe('Effects toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'ci.yml', CI_YAML);
    await switchToGrid(page);
  });

  test('effects button has aria-pressed=true by default', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Toggle visual effects/ });
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  test('effects toggle changes aria-pressed to false', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Toggle visual effects/ });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('Keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'ci.yml', CI_YAML);
    await switchToGrid(page);
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await page.waitForTimeout(300);
  });

  test('ArrowRight moves focus to next card', async ({ page }) => {
    await page.getByRole('button', { name: 'View details for lint' }).focus();
    await page.keyboard.press('ArrowRight');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    expect(focused).toContain('View details for');
  });

  test('ArrowLeft moves focus to previous card', async ({ page }) => {
    await page.getByRole('button', { name: 'View details for test' }).focus();
    await page.keyboard.press('ArrowLeft');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    expect(focused).toContain('View details for');
  });

  test('ArrowDown moves focus to next card', async ({ page }) => {
    await page.getByRole('button', { name: 'View details for lint' }).focus();
    await page.keyboard.press('ArrowDown');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    expect(focused).toContain('View details for');
  });

  test('ArrowUp moves focus to previous card', async ({ page }) => {
    await page.getByRole('button', { name: 'View details for test' }).focus();
    await page.keyboard.press('ArrowUp');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    expect(focused).toContain('View details for');
  });
});

// ─── 1. Step-level navigation ─────────────────────────────────────────────────

test.describe('Step-level navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'ci.yml', CI_YAML);
    await switchToGrid(page);
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await expect(page.getByRole('button', { name: 'View details for lint' })).toBeVisible({ timeout: 5000 });
  });

  test('drills into steps from job level', async ({ page }) => {
    await page.getByRole('button', { name: 'Drill into lint' }).click();
    await expect(page.getByRole('button', { name: /View details for Checkout/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /View details for Lint/ })).toBeVisible();
  });

  test('URL updates to step level after drill', async ({ page }) => {
    await page.getByRole('button', { name: 'Drill into lint' }).click();
    await page.waitForTimeout(400);
    expect(page.url()).toContain('level=step');
  });

  test('breadcrumb shows job name at step level', async ({ page }) => {
    await page.getByRole('button', { name: 'Drill into lint' }).click();
    await expect(page.getByRole('button', { name: /View details for Checkout/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /lint/ })).toBeVisible();
  });

  test('step cards have no drill-down strip', async ({ page }) => {
    await page.getByRole('button', { name: 'Drill into lint' }).click();
    await expect(page.getByRole('button', { name: /View details for Checkout/ })).toBeVisible({ timeout: 5000 });
    // No drill-into button should exist at step level
    await expect(page.getByRole('button', { name: /Drill into Checkout/ })).not.toBeVisible();
  });

  test('step popup shows run script', async ({ page }) => {
    await page.getByRole('button', { name: 'Drill into lint' }).click();
    await expect(page.getByRole('button', { name: /View details for Lint/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /View details for Lint/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Script')).toBeVisible();
    await expect(dialog.getByText('npm run lint')).toBeVisible();
  });

  test('step popup shows uses action', async ({ page }) => {
    await page.getByRole('button', { name: 'Drill into lint' }).click();
    await expect(page.getByRole('button', { name: /View details for Checkout/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /View details for Checkout/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Action', { exact: true })).toBeVisible();
    await expect(dialog.getByText('actions/checkout@v4')).toBeVisible();
  });

  test('navigates back to job level via breadcrumb', async ({ page }) => {
    await page.getByRole('button', { name: 'Drill into lint' }).click();
    await expect(page.getByRole('button', { name: /View details for Checkout/ })).toBeVisible({ timeout: 5000 });
    // Click "lint" breadcrumb (last item before current level)
    await page.locator('nav').getByRole('button', { name: /lint/ }).click();
    await expect(page.getByRole('button', { name: 'View details for lint' })).toBeVisible({ timeout: 5000 });
  });
});

// ─── 2. Step popup — detailed properties ──────────────────────────────────────

test.describe('Step popup — detailed properties', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'steps.yml', STEPS_YAML);
    await switchToGrid(page);
    await page.getByRole('button', { name: 'Drill into Steps Demo' }).click();
    await expect(page.getByRole('button', { name: 'View details for build' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Drill into build' }).click();
    await expect(page.getByRole('button', { name: /View details for Build/ })).toBeVisible({ timeout: 5000 });
  });

  test('step popup shows with inputs', async ({ page }) => {
    await page.getByRole('button', { name: /View details for Checkout/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('With')).toBeVisible();
    await expect(dialog.getByText('fetch-depth')).toBeVisible();
  });

  test('step popup shows env vars', async ({ page }) => {
    await page.getByRole('button', { name: /View details for Build/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Env', { exact: true })).toBeVisible();
    await expect(dialog.getByText('NODE_ENV')).toBeVisible();
  });

  test('step popup shows timeout', async ({ page }) => {
    await page.getByRole('button', { name: /View details for Build/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Timeout')).toBeVisible();
    await expect(dialog.getByText('10m')).toBeVisible();
  });

  test('step popup shows if condition', async ({ page }) => {
    await page.getByRole('button', { name: /View details for Conditional/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Condition', { exact: true })).toBeVisible();
  });

  test('step popup shows continue-on-error', async ({ page }) => {
    await page.getByRole('button', { name: /View details for Conditional/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('continue-on-error')).toBeVisible();
  });
});

// ─── 3. Reusable workflow drill-down ──────────────────────────────────────────

test.describe('Reusable workflow drill-down', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'main.yml', ORCHESTRATOR_YAML);
    await loadYamlViaOverlay(page, REUSABLE_YAML, 'reusable.yml');
    await switchToGrid(page);
  });

  test('orchestrator card shows calls pill', async ({ page }) => {
    await expect(page.getByText(/calls/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('uses-job card renders with workflow styling', async ({ page }) => {
    await page.getByRole('button', { name: 'Drill into Main Orchestrator' }).click();
    await expect(page.getByRole('button', { name: 'View details for call-build' })).toBeVisible({ timeout: 5000 });
    // The uses-job should have "Open reusable workflow" drill strip
    await expect(page.getByRole('button', { name: /Open reusable workflow/ })).toBeVisible();
  });

  test('drills into reusable workflow jobs', async ({ page }) => {
    await page.getByRole('button', { name: 'Drill into Main Orchestrator' }).click();
    await expect(page.getByRole('button', { name: /Open reusable workflow/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Open reusable workflow/ }).click();
    await expect(page.getByRole('button', { name: /View details for build/ })).toBeVisible({ timeout: 5000 });
  });

  test('breadcrumb includes reusable workflow entry', async ({ page }) => {
    await page.getByRole('button', { name: 'Drill into Main Orchestrator' }).click();
    await expect(page.getByRole('button', { name: /Open reusable workflow/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Open reusable workflow/ }).click();
    await expect(page.getByRole('button', { name: /View details for build/ })).toBeVisible({ timeout: 5000 });
    // Breadcrumb should have at least 2 items (orchestrator + call-build)
    const crumbs = page.locator('nav').getByRole('button');
    await expect(crumbs).toHaveCount(3); // ROOT + Main Orchestrator + call-build
  });

  test('popup Calls section links to reusable workflow', async ({ page }) => {
    await page.getByRole('button', { name: 'View details for Main Orchestrator' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Calls')).toBeVisible();
    await expect(dialog.getByText(/reusable\.yml/)).toBeVisible();
  });
});

// ─── 4. Graph view ────────────────────────────────────────────────────────────

test.describe('Graph view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'ci.yml', CI_YAML);
    // Graph is the default view — no switchToGrid
  });

  test('graph view is active by default', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Switch to graph view' });
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  test('graph renders nodes for loaded workflows', async ({ page }) => {
    // React Flow renders nodes as elements; check the canvas container is present
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 8000 });
  });

  test('switching to grid and back to graph works', async ({ page }) => {
    await page.getByTitle('Grid view').click();
    await expect(page.getByRole('button', { name: 'Switch to grid view' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByTitle('Graph view').click();
    await expect(page.getByRole('button', { name: 'Switch to graph view' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 8000 });
  });

  test('pane click closes popup in graph view', async ({ page }) => {
    // Drill to job level in graph, open a popup, then click pane
    await page.getByTitle('Grid view').click();
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await page.getByTitle('Graph view').click();
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 8000 });
    // Click the React Flow pane background to close any open popup
    await page.locator('.react-flow__pane').click({ force: true });
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

// ─── 5. Load-more overlay ────────────────────────────────────────────────────

test.describe('Load-more overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'ci.yml', CI_YAML);
    await switchToGrid(page);
  });

  test('+ LOAD FILES button opens overlay', async ({ page }) => {
    await page.getByRole('button', { name: /LOAD FILES|FILES/i }).first().click();
    // Overlay opens with File tab by default — switch to Paste to get textarea
    await page.getByRole('button', { name: /PASTE/i }).last().click();
    await expect(page.locator('textarea')).toBeVisible({ timeout: 5000 });
  });

  test('clicking backdrop closes overlay', async ({ page }) => {
    await page.getByRole('button', { name: /LOAD FILES|FILES/i }).first().click();
    await expect(page.locator('.fixed.inset-0.z-50')).toBeVisible({ timeout: 5000 });
    // Click the semi-transparent backdrop (the fixed overlay div behind the modal)
    await page.locator('.fixed.inset-0.z-50').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.fixed.inset-0.z-50')).not.toBeVisible({ timeout: 3000 });
  });

  test('navigation state is preserved after loading more files', async ({ page }) => {
    // Drill into jobs before opening overlay
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await expect(page.getByRole('button', { name: 'View details for lint' })).toBeVisible({ timeout: 5000 });
    // Load a second workflow via overlay
    await loadYamlViaOverlay(page, DISPATCH_YAML);
    // Should still be at job level for CI Pipeline
    await expect(page.getByRole('button', { name: 'View details for lint' })).toBeVisible({ timeout: 5000 });
  });
});

// ─── 6. Multiple workflows — additive loading ─────────────────────────────────

test.describe('Additive workflow loading', () => {
  test('loading a second workflow adds it without resetting navigation', async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'ci.yml', CI_YAML);
    await switchToGrid(page);
    await page.getByRole('button', { name: 'Drill into CI Pipeline' }).click();
    await expect(page.getByRole('button', { name: 'View details for lint' })).toBeVisible({ timeout: 5000 });
    // Load second file via overlay
    await loadYamlViaOverlay(page, DISPATCH_YAML);
    // Navigation should stay at job level, CI Pipeline jobs still visible
    await expect(page.getByRole('button', { name: 'View details for lint' })).toBeVisible({ timeout: 5000 });
    // Go back to root and confirm both workflows are now present
    await page.locator('nav').getByRole('button').first().click();
    await expect(page.getByRole('button', { name: 'Drill into CI Pipeline' })).toBeVisible({ timeout: 5000 });
  });

  test('second loaded workflow appears at orchestrator level', async ({ page }) => {
    await page.goto('/');
    await loadYaml(page, 'ci.yml', CI_YAML);
    await switchToGrid(page);
    // Load dispatch workflow via overlay
    await loadYamlViaOverlay(page, DISPATCH_YAML);
    // Both workflows should now be visible (both have no uses: jobs, so both shown as fallback)
    await expect(page.getByRole('button', { name: /Drill into CI Pipeline/ })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Drill into Manual Deploy/ })).toBeVisible({ timeout: 5000 });
  });
});

// ─── 7. Intermediate breadcrumb navigation ────────────────────────────────────

test.describe('Intermediate breadcrumb navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Load orchestrator + reusable so we can get 3 breadcrumb levels deep
    await loadYaml(page, 'main.yml', ORCHESTRATOR_YAML);
    await loadYamlViaOverlay(page, REUSABLE_YAML, 'reusable.yml');
    await switchToGrid(page);
    // Drill: orchestrator → call-build job (uses:) → reusable jobs → steps
    await page.getByRole('button', { name: 'Drill into Main Orchestrator' }).click();
    await expect(page.getByRole('button', { name: /Open reusable workflow/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Open reusable workflow/ }).click();
    await expect(page.getByRole('button', { name: /View details for build/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Drill into build' }).click();
    await expect(page.getByRole('button', { name: /View details for Checkout/ })).toBeVisible({ timeout: 5000 });
  });

  test('clicking intermediate breadcrumb navigates to that level', async ({ page }) => {
    // We're at step level; click the "call-build" breadcrumb (2nd item after ROOT)
    const crumbs = page.locator('nav').getByRole('button');
    // ROOT | Main Orchestrator | call-build | build
    // Clicking index 2 = "call-build" = goes back to reusable workflow jobs
    await crumbs.nth(2).click();
    await expect(page.getByRole('button', { name: /View details for build/ })).toBeVisible({ timeout: 5000 });
    // Step cards should no longer be visible
    await expect(page.getByRole('button', { name: /View details for Checkout/ })).not.toBeVisible();
  });

  test('clicking root from deep level returns to orchestrator', async ({ page }) => {
    await page.locator('nav').getByRole('button').first().click();
    await expect(page.getByRole('button', { name: 'Drill into Main Orchestrator' })).toBeVisible({ timeout: 5000 });
  });
});
