import { describe, expect, it } from 'vitest';

import { filterDownloads } from '../../src/domain/downloads/filter-downloads';
import { groupDownloadsByTime } from '../../src/domain/downloads/group-downloads';
import { searchDownloads } from '../../src/domain/downloads/search-downloads';
import { DOWNLOAD_SORTS, sortDownloads } from '../../src/domain/downloads/sort-downloads';
import type { DownloadRecord, DownloadState, FileCategory } from '../../src/domain/downloads/types';

function localIso(
  year: number,
  monthIndex: number,
  day: number,
  hours = 12,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
): string {
  return new Date(year, monthIndex, day, hours, minutes, seconds, milliseconds).toISOString();
}

function download(overrides: Partial<DownloadRecord> & { id: number }): DownloadRecord {
  return {
    filename: `/Downloads/file-${overrides.id}.bin`,
    basename: `file-${overrides.id}`,
    extension: 'bin',
    mime: 'application/octet-stream',
    category: 'other',
    state: 'complete',
    paused: false,
    canResume: false,
    exists: true,
    danger: '',
    error: null,
    url: `https://source.example/files/${overrides.id}`,
    finalUrl: null,
    referrer: null,
    sourceDomain: 'source.example',
    bytesReceived: 0,
    totalBytes: 0,
    fileSize: 0,
    startTime: localIso(2026, 7, 14),
    endTime: null,
    estimatedEndTime: null,
    ...overrides,
    id: overrides.id,
  };
}

describe('searchDownloads', () => {
  it.each([
    ['filename', { filename: '/Users/me/Reports/Quarterly Plan.PDF' }, 'quarterly'],
    ['basename', { basename: 'Vacation Budget' }, 'vacation'],
    ['extension', { extension: 'zip' }, 'zip'],
    ['mime', { mime: 'image/png' }, 'image/png'],
    ['category', { category: 'archive' as FileCategory }, 'archive'],
    ['state', { state: 'interrupted' as DownloadState }, 'interrupted'],
    ['sourceDomain', { sourceDomain: 'docs.example.com' }, 'docs.example'],
    ['url', { url: 'https://files.example.com/releases/app.dmg' }, 'releases/app'],
    ['finalUrl', { finalUrl: 'https://cdn.example.com/final/report.csv' }, 'final/report'],
    ['referrer', { referrer: 'https://portal.example.com/invoices/2026' }, 'invoices/2026'],
    ['danger', { danger: 'uncommon-danger' }, 'uncommon-danger'],
    ['error', { error: 'NETWORK_FAILED' }, 'network_failed'],
  ])('matches the %s field', (_fieldName, overrides, query) => {
    const matching = download({ id: 1, ...overrides });
    const other = download({ id: 2 });

    expect(searchDownloads([other, matching], query)).toEqual([matching]);
  });

  it('trims whitespace, ignores case, and requires every query token to match', () => {
    const matching = download({
      id: 1,
      filename: '/Downloads/Quarterly Budget.pdf',
      sourceDomain: 'Finance.Example',
    });
    const missingOneToken = download({
      id: 2,
      filename: '/Downloads/Quarterly Notes.pdf',
      sourceDomain: 'docs.example',
    });

    expect(searchDownloads([matching, missingOneToken], '  FINANCE quarterly  ')).toEqual([matching]);
  });

  it('returns the current records unchanged for an empty query', () => {
    const records = [download({ id: 1 }), download({ id: 2 })];

    expect(searchDownloads(records, '   ')).toEqual(records);
  });
});

describe('filterDownloads', () => {
  it('filters by explicit state and task predicates', () => {
    const active = download({ id: 1, state: 'in_progress' });
    const completed = download({ id: 2, state: 'complete' });
    const failed = download({ id: 3, state: 'interrupted' });

    expect(filterDownloads([active, completed, failed], { state: 'complete' })).toEqual([completed]);
    expect(filterDownloads([active, completed, failed], { predicate: 'active' })).toEqual([active]);
    expect(filterDownloads([active, completed, failed], { predicate: 'completed' })).toEqual([completed]);
    expect(filterDownloads([active, completed, failed], { predicate: 'failed' })).toEqual([failed]);
    expect(filterDownloads([active, completed, failed], { predicate: 'all' })).toEqual([
      active,
      completed,
      failed,
    ]);
  });

  it('filters by category, file existence, danger, resume state, pause state, and start range', () => {
    const matching = download({
      id: 1,
      category: 'document',
      exists: false,
      danger: 'uncommon',
      canResume: true,
      paused: true,
      startTime: localIso(2026, 7, 14, 9),
    });
    const wrongCategory = download({ id: 2, category: 'image', exists: false, danger: 'uncommon' });
    const stillExists = download({ id: 3, category: 'document', exists: true, danger: 'uncommon' });
    const safe = download({ id: 4, category: 'document', exists: false, danger: '' });
    const notResumable = download({
      id: 5,
      category: 'document',
      exists: false,
      danger: 'uncommon',
      canResume: false,
      paused: true,
    });
    const notPaused = download({
      id: 6,
      category: 'document',
      exists: false,
      danger: 'uncommon',
      canResume: true,
      paused: false,
    });
    const tooEarly = download({
      id: 7,
      category: 'document',
      exists: false,
      danger: 'uncommon',
      canResume: true,
      paused: true,
      startTime: localIso(2026, 7, 13, 23, 59),
    });
    const tooLate = download({
      id: 8,
      category: 'document',
      exists: false,
      danger: 'uncommon',
      canResume: true,
      paused: true,
      startTime: localIso(2026, 7, 15),
    });

    expect(
      filterDownloads(
        [matching, wrongCategory, stillExists, safe, notResumable, notPaused, tooEarly, tooLate],
        {
          category: 'document',
          missing: true,
          danger: 'uncommon',
          canResume: true,
          paused: true,
          startedAfter: localIso(2026, 7, 14, 0),
          startedBefore: localIso(2026, 7, 14, 23, 59, 59, 999),
        },
      ),
    ).toEqual([matching]);
  });

  it('filters by extension, source domain, explicit existence, and size range', () => {
    const matching = download({
      id: 1,
      extension: 'PDF',
      sourceDomain: 'Docs.Example',
      exists: true,
      fileSize: 1_500,
    });
    const wrongExtension = download({
      id: 2,
      extension: 'zip',
      sourceDomain: 'docs.example',
      exists: true,
      fileSize: 1_500,
    });
    const wrongDomain = download({
      id: 3,
      extension: 'pdf',
      sourceDomain: 'cdn.example',
      exists: true,
      fileSize: 1_500,
    });
    const missing = download({
      id: 4,
      extension: 'pdf',
      sourceDomain: 'docs.example',
      exists: false,
      fileSize: 1_500,
    });
    const tooSmall = download({
      id: 5,
      extension: 'pdf',
      sourceDomain: 'docs.example',
      exists: true,
      fileSize: 999,
    });
    const tooLarge = download({
      id: 6,
      extension: 'pdf',
      sourceDomain: 'docs.example',
      exists: true,
      fileSize: 2_001,
    });

    expect(
      filterDownloads([matching, wrongExtension, wrongDomain, missing, tooSmall, tooLarge], {
        extension: 'pdf',
        sourceDomain: 'docs.example',
        exists: true,
        minSize: 1_000,
        maxSize: 2_000,
      }),
    ).toEqual([matching]);
  });

  it('treats Chrome safe danger states as non-dangerous for boolean danger filters', () => {
    const dangerous = download({ id: 1, danger: 'file' });
    const uncommon = download({ id: 2, danger: 'uncommon' });
    const accepted = download({ id: 3, danger: 'accepted' });
    const deepScannedSafe = download({ id: 4, danger: 'deepScannedSafe' });
    const safe = download({ id: 5, danger: 'safe' });
    const empty = download({ id: 6, danger: '' });

    expect(filterDownloads([dangerous, uncommon, accepted, deepScannedSafe, safe, empty], {
      danger: true,
    })).toEqual([dangerous, uncommon]);
    expect(filterDownloads([dangerous, uncommon, accepted, deepScannedSafe, safe, empty], {
      danger: false,
    })).toEqual([accepted, deepScannedSafe, safe, empty]);
  });

  it('filters optional possible duplicate metadata without requiring it on base records', () => {
    const possibleDuplicate = { ...download({ id: 1 }), possibleDuplicate: true };
    const unique = { ...download({ id: 2 }), possibleDuplicate: false };
    const unknown = download({ id: 3 });

    expect(filterDownloads([possibleDuplicate, unique, unknown], {
      possibleDuplicate: true,
    })).toEqual([possibleDuplicate]);
    expect(filterDownloads([possibleDuplicate, unique, unknown], {
      possibleDuplicate: false,
    })).toEqual([unique, unknown]);
  });
});

describe('sortDownloads', () => {
  it.each([
    [DOWNLOAD_SORTS.startTimeDesc, [3, 1, 2]],
    [DOWNLOAD_SORTS.startTimeAsc, [2, 1, 3]],
    [DOWNLOAD_SORTS.filenameAsc, [2, 1, 3]],
    [DOWNLOAD_SORTS.filenameDesc, [3, 1, 2]],
    [DOWNLOAD_SORTS.sizeDesc, [1, 3, 2]],
    [DOWNLOAD_SORTS.sizeAsc, [2, 3, 1]],
    [DOWNLOAD_SORTS.stateAsc, [3, 2, 1]],
    [DOWNLOAD_SORTS.categoryAsc, [2, 1, 3]],
    [DOWNLOAD_SORTS.sourceDomainAsc, [2, 1, 3]],
    [DOWNLOAD_SORTS.sourceDomainDesc, [3, 1, 2]],
  ])('sorts with option %j without mutating the input', (option, expectedIds) => {
    const downloads = [
      download({
        id: 1,
        filename: '/Downloads/beta.zip',
        basename: 'beta',
        category: 'document',
        state: 'interrupted',
        fileSize: 300,
        sourceDomain: 'docs.example',
        totalBytes: 300,
        startTime: localIso(2026, 7, 14, 10),
      }),
      download({
        id: 2,
        filename: '/Downloads/alpha.zip',
        basename: 'alpha',
        category: 'archive',
        state: 'complete',
        fileSize: 100,
        sourceDomain: 'alpha.example',
        totalBytes: 100,
        startTime: localIso(2026, 7, 13, 10),
      }),
      download({
        id: 3,
        filename: '/Downloads/gamma.zip',
        basename: 'gamma',
        category: 'image',
        state: 'in_progress',
        fileSize: 200,
        sourceDomain: 'zeta.example',
        totalBytes: 200,
        startTime: localIso(2026, 7, 15, 10),
      }),
    ];

    const sorted = sortDownloads(downloads, option);

    expect(sorted.map((record) => record.id)).toEqual(expectedIds);
    expect(downloads.map((record) => record.id)).toEqual([1, 2, 3]);
  });

  it('keeps records with equal sort keys in their original order', () => {
    const first = download({ id: 1, filename: '/Downloads/same.txt', basename: 'same' });
    const second = download({ id: 2, filename: '/Downloads/same.txt', basename: 'same' });
    const third = download({ id: 3, filename: '/Downloads/zzz.txt', basename: 'zzz' });

    expect(sortDownloads([first, second, third], DOWNLOAD_SORTS.filenameAsc)).toEqual([
      first,
      second,
      third,
    ]);
  });
});

describe('groupDownloadsByTime', () => {
  it('groups downloads across local day and week boundaries', () => {
    const now = new Date(2026, 7, 14, 12);
    const records = [
      download({ id: 1, startTime: localIso(2026, 7, 14, 0) }),
      download({ id: 2, startTime: localIso(2026, 7, 13, 23, 59, 59, 999) }),
      download({ id: 3, startTime: localIso(2026, 7, 10, 0) }),
      download({ id: 4, startTime: localIso(2026, 7, 9, 23, 59, 59, 999) }),
      download({ id: 5, startTime: localIso(2026, 7, 3, 0) }),
      download({ id: 6, startTime: localIso(2026, 7, 2, 23, 59, 59, 999) }),
    ];

    expect(groupDownloadsByTime(records, { now })).toEqual([
      { id: 'today', label: 'Today', downloads: [records[0]] },
      { id: 'yesterday', label: 'Yesterday', downloads: [records[1]] },
      { id: 'earlier-this-week', label: 'Earlier this week', downloads: [records[2]] },
      { id: 'last-week', label: 'Last week', downloads: [records[3], records[4]] },
      { id: 'older', label: 'Older', downloads: [records[5]] },
    ]);
  });
});
