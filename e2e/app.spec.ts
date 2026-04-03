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

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loadYaml(page: Page, _filename: string, content: string) {
  // Use the Paste tab — most reliable in E2E without a real filesystem
  await page.getByRole('button', { name: /PASTE/i }).click();
  const textarea = page.locator('textarea');
  await textarea.fill(content);
  await page.getByRole('button', { name: /PARSE/i }).click();
}

async function switchToGrid(page: Page) {
  await page.getByTitle('Grid view').click();
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
    // Focus first card button
    await page.getByRole('button', { name: 'View details for lint' }).focus();
    await page.keyboard.press('ArrowRight');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    expect(focused).toContain('View details for');
  });
});
