import { describe, expect, it } from 'vitest';

import { evaluateRules } from '../../src/domain/organizer/evaluate-rules';
import { BUILT_IN_ORGANIZER_PRESETS } from '../../src/domain/organizer/presets';
import { renderPathTemplate } from '../../src/domain/organizer/render-path-template';
import { sanitizeDownloadPath } from '../../src/domain/organizer/sanitize-download-path';
import type { DownloadRule } from '../../src/domain/organizer/types';
import type { DownloadRecord } from '../../src/domain/downloads/types';

const record: DownloadRecord = {
  id: 1,
  filename: 'annual report.PDF',
  basename: 'annual report',
  extension: 'pdf',
  mime: 'application/pdf',
  category: 'document',
  state: 'complete',
  paused: false,
  canResume: false,
  exists: false,
  danger: '',
  error: null,
  url: 'https://cdn.example.com/files/report.pdf',
  finalUrl: null,
  referrer: null,
  sourceDomain: 'cdn.example.com',
  bytesReceived: 100,
  totalBytes: 100,
  fileSize: 100,
  startTime: '2026-08-14T10:20:30.000Z',
  endTime: '2026-08-14T10:20:31.000Z',
  estimatedEndTime: null,
};

function rule(overrides: Partial<DownloadRule> = {}): DownloadRule {
  return {
    id: 'rule',
    name: 'Rule',
    enabled: true,
    priority: 10,
    conditions: [],
    targetPathTemplate: 'Sorted/{filename}',
    ...overrides,
  };
}

describe('evaluateRules', () => {
  it.each([
    ['source domain equals', { field: 'sourceDomain', operator: 'equals', value: 'cdn.example.com' }],
    ['source domain ends with', { field: 'sourceDomain', operator: 'endsWith', value: 'example.com' }],
    ['source domain contains', { field: 'sourceDomain', operator: 'contains', value: 'example' }],
    ['filename contains', { field: 'filename', operator: 'contains', value: 'report' }],
    ['filename starts with', { field: 'filename', operator: 'startsWith', value: 'annual' }],
    ['filename ends with', { field: 'filename', operator: 'endsWith', value: '.PDF' }],
    ['filename regex', { field: 'filename', operator: 'regex', value: '^annual.*PDF$' }],
    ['extension equals one of a list', { field: 'extension', operator: 'oneOf', value: ['docx', 'pdf'] as string[] }],
    ['MIME equals', { field: 'mime', operator: 'equals', value: 'application/pdf' }],
    ['MIME starts with', { field: 'mime', operator: 'startsWith', value: 'application/' }],
    ['category equals', { field: 'category', operator: 'equals', value: 'document' }],
  ] as const)('matches %s', (_name, condition) => {
    expect(evaluateRules(record, [rule({ conditions: [condition] })], 'uniquify')).toMatchObject({
      filename: 'Sorted/annual report.PDF',
      ruleId: 'rule',
      conflictAction: 'uniquify',
    });
  });

  it('requires every condition in a rule to match', () => {
    const result = evaluateRules(record, [rule({
      conditions: [
        { field: 'category', operator: 'equals', value: 'document' },
        { field: 'extension', operator: 'equals', value: 'zip' },
      ],
    })], 'uniquify');

    expect(result).toBeNull();
  });

  it('ignores disabled rules', () => {
    expect(evaluateRules(record, [rule({ enabled: false })], 'uniquify')).toBeNull();
  });

  it('uses the lowest numeric priority before input order', () => {
    const result = evaluateRules(record, [
      rule({ id: 'later', priority: 20, targetPathTemplate: 'Later/{filename}' }),
      rule({ id: 'first', priority: 5, targetPathTemplate: 'First/{filename}' }),
    ], 'overwrite');

    expect(result).toMatchObject({ filename: 'First/annual report.PDF', ruleId: 'first', conflictAction: 'overwrite' });
  });

  it('keeps input order for equal priorities and stops at the first match', () => {
    const result = evaluateRules(record, [
      rule({ id: 'first', targetPathTemplate: 'First/{filename}' }),
      rule({ id: 'second', targetPathTemplate: 'Second/{filename}' }),
    ], 'prompt');

    expect(result).toMatchObject({ filename: 'First/annual report.PDF', ruleId: 'first', conflictAction: 'prompt' });
  });

  it('uses uniquify when no conflict action is supplied', () => {
    expect(evaluateRules(record, [rule()])).toMatchObject({ conflictAction: 'uniquify' });
  });

  it('lets a following valid rule win when an earlier regex is invalid', () => {
    const result = evaluateRules(record, [
      rule({ id: 'invalid', priority: 1, conditions: [{ field: 'filename', operator: 'regex', value: '[' }] }),
      rule({ id: 'valid', priority: 2, targetPathTemplate: 'Valid/{filename}' }),
    ], 'uniquify');

    expect(result).toMatchObject({ filename: 'Valid/annual report.PDF', ruleId: 'valid' });
  });

  it('skips a matching rule whose rendered target path is unsafe', () => {
    const result = evaluateRules(record, [
      rule({ id: 'unsafe', priority: 1, targetPathTemplate: '../outside/{filename}' }),
      rule({ id: 'safe', priority: 2, targetPathTemplate: 'Safe/{filename}' }),
    ], 'uniquify');

    expect(result).toMatchObject({ filename: 'Safe/annual report.PDF', ruleId: 'safe' });
  });

  it('preserves the source extension when the template uses basename or only a folder', () => {
    expect(evaluateRules(record, [rule({ targetPathTemplate: 'Documents/{basename}' })], 'uniquify')).toMatchObject({
      filename: 'Documents/annual report.PDF',
    });
    expect(evaluateRules(record, [rule({ targetPathTemplate: 'Documents/' })], 'uniquify')).toMatchObject({
      filename: 'Documents/annual report.PDF',
    });
  });
});

describe('renderPathTemplate', () => {
  it('renders every supported token using UTC date parts', () => {
    expect(renderPathTemplate('{year}/{month}/{day}/{domain}/{category}/{extension}/{filename}/{basename}', record)).toBe(
      '2026/08/14/cdn.example.com/document/pdf/annual report.PDF/annual report',
    );
  });
});

describe('sanitizeDownloadPath', () => {
  it('normalizes separators, removes control characters, and replaces problematic filename characters', () => {
    expect(sanitizeDownloadPath('Images\\2026//bad\u0000:name?*.jpg')).toBe('Images/2026/bad_name__.jpg');
  });

  it('rejects absolute paths and traversal segments', () => {
    expect(sanitizeDownloadPath('/absolute/report.pdf')).toBeNull();
    expect(sanitizeDownloadPath('C:\\absolute\\report.pdf')).toBeNull();
    expect(sanitizeDownloadPath('safe/../report.pdf')).toBeNull();
  });
});

describe('built-in organizer presets', () => {
  it('offers deterministic disabled category rules with stable priorities', () => {
    expect(BUILT_IN_ORGANIZER_PRESETS).toEqual([
      rule({ id: 'preset-images', name: 'Images', enabled: false, priority: 10, conditions: [{ field: 'category', operator: 'equals', value: 'image' }], targetPathTemplate: 'Images/' }),
      rule({ id: 'preset-videos', name: 'Videos', enabled: false, priority: 20, conditions: [{ field: 'category', operator: 'equals', value: 'video' }], targetPathTemplate: 'Videos/' }),
      rule({ id: 'preset-audio', name: 'Audio', enabled: false, priority: 30, conditions: [{ field: 'category', operator: 'equals', value: 'audio' }], targetPathTemplate: 'Audio/' }),
      rule({ id: 'preset-documents', name: 'Documents', enabled: false, priority: 40, conditions: [{ field: 'category', operator: 'equals', value: 'document' }], targetPathTemplate: 'Documents/' }),
      rule({ id: 'preset-archives', name: 'Archives', enabled: false, priority: 50, conditions: [{ field: 'category', operator: 'equals', value: 'archive' }], targetPathTemplate: 'Archives/' }),
      rule({ id: 'preset-installers', name: 'Installers', enabled: false, priority: 60, conditions: [{ field: 'category', operator: 'equals', value: 'installer' }], targetPathTemplate: 'Installers/' }),
      rule({ id: 'preset-code', name: 'Code', enabled: false, priority: 70, conditions: [{ field: 'category', operator: 'equals', value: 'code' }], targetPathTemplate: 'Code/' }),
      rule({ id: 'preset-other', name: 'Other', enabled: false, priority: 80, conditions: [{ field: 'category', operator: 'equals', value: 'other' }], targetPathTemplate: 'Other/' }),
    ]);
  });
});
