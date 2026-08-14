import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DownloadSearchQuery, DownloadsPort } from '../../src/application/download-repository';
import type { DownloadRecord } from '../../src/domain/downloads/types';
import { DEFAULT_SETTINGS } from '../../src/domain/settings/defaults';
import type { DownloadRule, DownlySettings } from '../../src/domain/settings/types';
import { ManagerApp, type RuntimeMessageSource } from '../../src/ui/manager/ManagerApp';

function download(overrides: Partial<DownloadRecord> = {}): DownloadRecord {
  return {
    id: 1,
    filename: '/Users/test/Invoice 2026.pdf',
    basename: 'Invoice 2026',
    extension: 'pdf',
    mime: 'application/pdf',
    category: 'document',
    state: 'complete',
    paused: false,
    canResume: false,
    exists: true,
    danger: 'safe',
    error: null,
    url: 'https://billing.example/invoice.pdf',
    finalUrl: null,
    referrer: null,
    sourceDomain: 'billing.example',
    bytesReceived: 2_048,
    totalBytes: 2_048,
    fileSize: 2_048,
    startTime: '2026-08-14T10:20:30.000Z',
    endTime: '2026-08-14T10:20:31.000Z',
    estimatedEndTime: null,
    ...overrides,
  };
}

function rule(overrides: Partial<DownloadRule> = {}): DownloadRule {
  return {
    id: 'rule-documents',
    name: 'Documents',
    enabled: true,
    priority: 10,
    conditions: [{ field: 'category', operator: 'equals', value: 'document' }],
    targetPathTemplate: 'Documents/',
    ...overrides,
  };
}

function createPort(history: DownloadRecord[] = [download()]): DownloadsPort {
  return {
    search: vi.fn(async (query: DownloadSearchQuery) => query.state === 'in_progress' ? [] : history),
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

function createRuntimeMessages(): RuntimeMessageSource {
  return {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  };
}

function installStorage(initial: Partial<DownlySettings> = {}) {
  let stored: DownlySettings = { ...DEFAULT_SETTINGS, ...initial };
  const writes: DownlySettings[] = [];
  const chrome = {
    runtime: {},
    storage: {
      local: {
        get(_key: string, callback: (items: Record<string, unknown>) => void) {
          callback({ downlySettings: stored });
        },
        set(items: Record<string, unknown>, callback: () => void) {
          stored = items.downlySettings as DownlySettings;
          writes.push(stored);
          callback();
        },
      },
    },
  };

  vi.stubGlobal('chrome', chrome);

  return {
    get stored() {
      return stored;
    },
    writes,
  };
}

async function renderOrganizer(options: {
  downloads?: DownloadRecord[];
  settings?: Partial<DownlySettings>;
} = {}) {
  const storage = installStorage(options.settings);

  render(
    <ManagerApp
      downloadsPort={createPort(options.downloads)}
      runtimeMessages={createRuntimeMessages()}
      now={new Date('2026-08-14T12:00:00.000Z')}
    />,
  );

  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Smart Organizer' }));
  await screen.findByRole('heading', { name: 'Smart Organizer' });
  await screen.findByRole('checkbox', { name: 'Enable Smart Organizer' });

  return storage;
}

async function waitForLastWrite(storage: ReturnType<typeof installStorage>) {
  await waitFor(() => expect(storage.writes.length).toBeGreaterThan(0));
  return storage.writes.at(-1)!;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Smart Organizer manager UI', () => {
  it('toggles automatic organization and persists organizerEnabled', async () => {
    const storage = await renderOrganizer({ settings: { organizerEnabled: false } });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Smart Organizer' }));

    await waitFor(() => expect(storage.stored.organizerEnabled).toBe(true));
    expect((await waitForLastWrite(storage)).organizerEnabled).toBe(true);
  });

  it('installs a built-in preset as an enabled rule and previews the target path', async () => {
    const storage = await renderOrganizer({
      downloads: [download({ filename: '/Users/test/photo.jpg', basename: 'photo', extension: 'jpg', mime: 'image/jpeg', category: 'image' })],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Install Images preset' }));

    await waitFor(() => expect(storage.stored.rules).toHaveLength(1));
    expect(storage.stored.rules[0]).toMatchObject({
      id: 'preset-images',
      name: 'Images',
      enabled: true,
      priority: 10,
      targetPathTemplate: 'Images/',
    });
    expect(screen.getByRole('article', { name: 'Images rule' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Target path preview' }).textContent).toContain('Images/photo.jpg');
    expect(screen.getByRole('region', { name: 'Target path preview' }).textContent).toContain('Conflict action: uniquify');
  });

  it('creates, edits, toggles, reorders, and deletes custom rules with complete rules persistence', async () => {
    const images = rule({ id: 'images', name: 'Images', priority: 10, conditions: [{ field: 'category', operator: 'equals', value: 'image' }], targetPathTemplate: 'Images/' });
    const storage = await renderOrganizer({ settings: { organizerEnabled: true, rules: [images] } });

    fireEvent.click(screen.getByRole('button', { name: 'New custom rule' }));
    fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'PDF invoices' } });
    fireEvent.change(screen.getByLabelText('Condition field 1'), { target: { value: 'extension' } });
    fireEvent.change(screen.getByLabelText('Condition operator 1'), { target: { value: 'oneOf' } });
    fireEvent.change(screen.getByLabelText('Condition value 1'), { target: { value: 'pdf,docx' } });
    fireEvent.change(screen.getByLabelText('Target path template'), { target: { value: 'Invoices/{year}/{filename}' } });

    expect(screen.getByRole('region', { name: 'Target path preview' }).textContent).toContain('Invoices/2026/Invoice 2026.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));

    await waitFor(() => expect(storage.stored.rules).toHaveLength(2));
    expect(storage.stored.rules.map((savedRule) => savedRule.name)).toEqual(['Images', 'PDF invoices']);
    expect(storage.stored.rules[1]).toMatchObject({
      enabled: true,
      priority: 20,
      conditions: [{ field: 'extension', operator: 'oneOf', value: ['pdf', 'docx'] }],
      targetPathTemplate: 'Invoices/{year}/{filename}',
    });

    const pdfRule = screen.getByRole('article', { name: 'PDF invoices rule' });
    fireEvent.click(within(pdfRule).getByRole('button', { name: 'Edit PDF invoices' }));
    fireEvent.change(screen.getByLabelText('Target path template'), { target: { value: 'Accounting/{basename}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));

    await waitFor(() => expect(storage.stored.rules[1].targetPathTemplate).toBe('Accounting/{basename}'));

    fireEvent.click(within(screen.getByRole('article', { name: 'PDF invoices rule' })).getByRole('checkbox', { name: 'Enable PDF invoices' }));
    await waitFor(() => expect(storage.stored.rules[1].enabled).toBe(false));

    fireEvent.click(within(screen.getByRole('article', { name: 'PDF invoices rule' })).getByRole('button', { name: 'Move PDF invoices up' }));
    await waitFor(() => expect(storage.stored.rules.map((savedRule) => savedRule.name)).toEqual(['PDF invoices', 'Images']));
    expect(storage.stored.rules.map((savedRule) => savedRule.priority)).toEqual([10, 20]);

    fireEvent.click(within(screen.getByRole('article', { name: 'PDF invoices rule' })).getByRole('button', { name: 'Delete PDF invoices' }));
    await waitFor(() => expect(storage.stored.rules.map((savedRule) => savedRule.name)).toEqual(['Images']));
  });

  it('uses priority order for display and mutations even when persisted rules are unsorted', async () => {
    const later = rule({ id: 'later', name: 'Later', priority: 30, targetPathTemplate: 'Later/' });
    const first = rule({ id: 'first', name: 'First', priority: 10, targetPathTemplate: 'First/' });
    const middle = rule({ id: 'middle', name: 'Middle', priority: 20, targetPathTemplate: 'Middle/' });
    const storage = await renderOrganizer({ settings: { rules: [later, first, middle] } });

    expect(screen.getAllByRole('article').map((article) => article.getAttribute('aria-label'))).toEqual([
      'First rule',
      'Middle rule',
      'Later rule',
    ]);

    fireEvent.click(within(screen.getByRole('article', { name: 'Middle rule' })).getByRole('button', { name: 'Move Middle up' }));

    await waitFor(() => expect(storage.stored.rules.map((savedRule) => savedRule.name)).toEqual(['Middle', 'First', 'Later']));
    expect(storage.stored.rules.map((savedRule) => savedRule.priority)).toEqual([10, 20, 30]);
  });

  it('reorders rules with drag and drop while persisting normalized priorities', async () => {
    const images = rule({ id: 'images', name: 'Images', priority: 10, conditions: [{ field: 'category', operator: 'equals', value: 'image' }], targetPathTemplate: 'Images/' });
    const documents = rule({ id: 'documents', name: 'Documents', priority: 20, targetPathTemplate: 'Documents/' });
    const storage = await renderOrganizer({ settings: { rules: [images, documents] } });

    const imagesRule = screen.getByRole('article', { name: 'Images rule' });
    const documentsRule = screen.getByRole('article', { name: 'Documents rule' });
    fireEvent.dragStart(documentsRule);
    fireEvent.dragOver(imagesRule);
    fireEvent.drop(imagesRule);

    await waitFor(() => expect(storage.stored.rules.map((savedRule) => savedRule.name)).toEqual(['Documents', 'Images']));
    expect(storage.stored.rules.map((savedRule) => savedRule.priority)).toEqual([10, 20]);
  });

  it('limits condition operators to the combinations supported by Smart Organizer', async () => {
    await renderOrganizer();

    fireEvent.click(screen.getByRole('button', { name: 'New custom rule' }));
    fireEvent.change(screen.getByLabelText('Condition field 1'), { target: { value: 'category' } });

    expect(screen.getByLabelText('Condition operator 1')).toHaveProperty('value', 'equals');
    expect(within(screen.getByLabelText('Condition operator 1')).queryByRole('option', { name: 'matches regex' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Condition field 1'), { target: { value: 'filename' } });
    expect(screen.getByLabelText('Condition operator 1')).toHaveProperty('value', 'contains');
    expect(within(screen.getByLabelText('Condition operator 1')).getByRole('option', { name: 'matches regex' })).toBeTruthy();
  });

  it('shows regex validation errors and keeps invalid rules out of storage', async () => {
    const storage = await renderOrganizer();

    fireEvent.click(screen.getByRole('button', { name: 'New custom rule' }));
    fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Broken regex' } });
    fireEvent.change(screen.getByLabelText('Condition field 1'), { target: { value: 'filename' } });
    fireEvent.change(screen.getByLabelText('Condition operator 1'), { target: { value: 'regex' } });
    fireEvent.change(screen.getByLabelText('Condition value 1'), { target: { value: '[' } });
    fireEvent.change(screen.getByLabelText('Target path template'), { target: { value: 'Broken/' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save rule' }));

    expect(await screen.findByText('Invalid regular expression')).toBeTruthy();
    expect(storage.stored.rules).toEqual([]);
  });
});
