import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const extensionPath = resolve(process.cwd(), 'dist');
const chromiumExecutable = chromium.executablePath();

test('loads the built extension and starts its service worker without errors', async () => {
  test.skip(!existsSync(chromiumExecutable), 'Playwright Chromium is not installed in this environment.');

  const context = await test.step('launch Chrome with the built extension', launchExtension);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  context.on('page', (page) => {
    watchPage(page, consoleErrors, pageErrors);
  });

  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    worker.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    const extensionId = new URL(worker.url()).host;
    const manager = await context.newPage();
    watchPage(manager, consoleErrors, pageErrors);
    await manager.goto(`chrome-extension://${extensionId}/manager.html`);
    await expect(manager.locator('#root')).toHaveText('Downly Download Manager');

    expect(worker.url()).toBe(`chrome-extension://${extensionId}/service-worker.js`);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    await context.close();
  }
});

async function launchExtension(): Promise<BrowserContext> {
  const { chromium } = await import('@playwright/test');

  return chromium.launchPersistentContext('', {
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
}

function watchPage(page: Page, consoleErrors: string[], pageErrors: string[]): void {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
}
