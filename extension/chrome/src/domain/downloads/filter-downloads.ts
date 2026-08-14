import type { DownloadRecord, DownloadState, FileCategory } from './types';

export type DownloadPredicate = 'all' | 'active' | 'completed' | 'failed';

type OneOrMany<T> = T | readonly T[];

export interface DownloadFilters {
  predicate?: DownloadPredicate;
  state?: OneOrMany<DownloadState>;
  category?: OneOrMany<FileCategory>;
  extension?: OneOrMany<string>;
  sourceDomain?: OneOrMany<string>;
  exists?: boolean;
  missing?: boolean;
  danger?: boolean | OneOrMany<string>;
  possibleDuplicate?: boolean;
  canResume?: boolean;
  paused?: boolean;
  startedAfter?: string | Date;
  startedBefore?: string | Date;
  minSize?: number;
  maxSize?: number;
}

export type DuplicateFilterMetadata = {
  possibleDuplicate?: boolean;
};

function valuesMatch<T>(value: T, expected: OneOrMany<T> | undefined): boolean {
  if (expected === undefined) {
    return true;
  }

  return Array.isArray(expected) ? expected.includes(value) : value === expected;
}

function lowerValuesMatch(value: string | null, expected: OneOrMany<string> | undefined): boolean {
  if (expected === undefined) {
    return true;
  }

  if (value === null) {
    return false;
  }

  const normalizedValue = value.toLocaleLowerCase();
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  return expectedValues.some((expectedValue) => normalizedValue === expectedValue.toLocaleLowerCase());
}

function predicateMatches(download: DownloadRecord, predicate: DownloadPredicate | undefined): boolean {
  switch (predicate) {
    case undefined:
    case 'all':
      return true;
    case 'active':
      return download.state === 'in_progress';
    case 'completed':
      return download.state === 'complete';
    case 'failed':
      return download.state === 'interrupted';
  }
}

function toTimestamp(value: string | Date | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function sizeOf(download: DownloadRecord): number {
  return download.fileSize || download.totalBytes || download.bytesReceived;
}

const SAFE_DANGER_STATES = new Set(['', 'safe', 'accepted', 'deepscannedsafe']);

function hasDanger(download: DownloadRecord): boolean {
  return !SAFE_DANGER_STATES.has(download.danger.trim().toLocaleLowerCase());
}

export function filterDownloads(
  downloads: readonly (DownloadRecord & DuplicateFilterMetadata)[],
  filters: DownloadFilters = {},
): Array<DownloadRecord & DuplicateFilterMetadata> {
  const startedAfter = toTimestamp(filters.startedAfter);
  const startedBefore = toTimestamp(filters.startedBefore);

  return downloads.filter((download) => {
    const startedAt = new Date(download.startTime).getTime();
    const size = sizeOf(download);

    if (!predicateMatches(download, filters.predicate)) return false;
    if (!valuesMatch(download.state, filters.state)) return false;
    if (!valuesMatch(download.category, filters.category)) return false;
    if (!lowerValuesMatch(download.extension, filters.extension)) return false;
    if (!lowerValuesMatch(download.sourceDomain, filters.sourceDomain)) return false;
    if (filters.exists !== undefined && download.exists !== filters.exists) return false;
    if (filters.missing !== undefined && download.exists === filters.missing) return false;
    if (filters.canResume !== undefined && download.canResume !== filters.canResume) return false;
    if (filters.paused !== undefined && download.paused !== filters.paused) return false;
    if (startedAfter !== null && startedAt < startedAfter) return false;
    if (startedBefore !== null && startedAt > startedBefore) return false;
    if (filters.minSize !== undefined && size < filters.minSize) return false;
    if (filters.maxSize !== undefined && size > filters.maxSize) return false;
    if (
      filters.possibleDuplicate !== undefined
      && Boolean(download.possibleDuplicate) !== filters.possibleDuplicate
    ) return false;

    if (filters.danger !== undefined) {
      if (typeof filters.danger === 'boolean') {
        if (hasDanger(download) !== filters.danger) return false;
      } else if (!lowerValuesMatch(download.danger, filters.danger)) {
        return false;
      }
    }

    return true;
  });
}
