import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { messages, requiredI18nKeys, t, type I18nKey } from '../../src/ui/shared/i18n';

const extensionRoot = resolve(__dirname, '../..');

describe('extension localization', () => {
  it('localizes all manifest-visible strings through Chrome messages', () => {
    const manifest = readJson<Record<string, unknown>>('public/manifest.json');
    const chromeMessages = readJson<Record<string, { message?: string }>>('public/_locales/en/messages.json');

    expect(manifest.name).toBe('__MSG_extensionName__');
    expect(manifest.description).toBe('__MSG_extensionDescription__');
    expect((manifest.action as { default_title?: string }).default_title).toBe('__MSG_extensionActionTitle__');
    expect((manifest.commands as Record<string, { description?: string }>)['open-downly-manager'].description)
      .toBe('__MSG_openDownlyManagerCommandDescription__');

    for (const key of [
      'extensionName',
      'extensionDescription',
      'extensionActionTitle',
      'openDownlyManagerCommandDescription',
    ]) {
      expect(chromeMessages[key]?.message?.trim()).toBeTruthy();
    }
  });

  it('provides non-empty English UI messages for the main product surfaces', () => {
    const expectedKeys: I18nKey[] = [
      'manager.title',
      'manager.sidebar.all',
      'manager.sidebar.duplicates',
      'manager.sidebar.statistics',
      'manager.sidebar.organizer',
      'manager.sidebar.settings',
      'manager.filters.sort',
      'manager.downloads.emptyTitle',
      'manager.duplicates.emptyTitle',
      'manager.statistics.title',
      'manager.organizer.title',
      'manager.settings.title',
      'sidePanel.title',
      'sidePanel.openManager',
      'shared.search.label',
      'shared.downloadActions.deleteFile',
      'shared.downloadStatus.complete',
      'shared.formatters.unknownSize',
      'shared.formatters.etaUnknown',
    ];

    expect(requiredI18nKeys).toEqual(expect.arrayContaining(expectedKeys));

    for (const key of requiredI18nKeys) {
      expect(messages[key]?.trim()).toBeTruthy();
      expect(t(key, sampleReplacements).trim()).not.toMatch(/\{\w+\}/);
    }
  });
});

const sampleReplacements = {
  action: 'uniquify',
  count: 1,
  duration: '1s',
  field: 'Filename',
  filename: 'Report.pdf',
  id: 1,
  message: 'Done',
  name: 'Images',
  number: 1,
  operator: 'equals',
  received: '1 KB',
  ruleId: 'rule',
  status: 'Complete',
  total: '2 KB',
  version: '0.1.0',
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(extensionRoot, path), 'utf8')) as T;
}
