import { act, cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DownloadsPort } from '../../src/application/download-repository';
import { ManagerApp } from '../../src/ui/manager/ManagerApp';
import { SidePanelApp } from '../../src/ui/sidepanel/SidePanelApp';

function createEmptyPort(): DownloadsPort {
  return {
    search: vi.fn(async () => []),
    getById: vi.fn(async () => null),
    pause: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    open: vi.fn(async () => undefined),
    show: vi.fn(),
    showDefaultFolder: vi.fn(),
    removeFile: vi.fn(async () => undefined),
    eraseById: vi.fn(async () => []),
    downloadAgain: vi.fn(async () => 1),
  };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('accessibility and responsive UX hardening', () => {
  it('keeps focus, theme, responsive, and reduced-motion rules in shared styles', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/shared/theme.css'), 'utf8');

    expect(css).toContain(':focus-visible');
    expect(css).toContain('outline-offset');
    expect(css).toContain(':root[data-theme="light"]');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(':root[data-theme="system"]');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (width <= 600px)');
    expect(css).toContain('@media (width >= 640px)');
    expect(css).toContain('@media (width >= 1024px)');
    expect(css).toContain('input:not([type="checkbox"]):not([type="radio"])');
  });

  it.each([320, 400, 600])('renders the side panel landmarks at %i px width', async (width) => {
    setViewportWidth(width);

    render(<SidePanelApp downloadsPort={createEmptyPort()} openManager={vi.fn()} />);
    await settle();

    expect(screen.getByRole('heading', { name: 'Downloads' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open full manager' })).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search downloads' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'No downloads' })).toBeTruthy();
  });

  it.each([640, 1024, 1440])('renders the manager landmarks at %i px width', async (width) => {
    setViewportWidth(width);

    render(<ManagerApp downloadsPort={createEmptyPort()} />);
    await settle();

    expect(screen.getByRole('heading', { name: 'Downly Download Manager' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Manager views' })).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search downloads' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Filters' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'Load older downloads' }).hasAttribute('disabled')).toBe(true);
  });
});
