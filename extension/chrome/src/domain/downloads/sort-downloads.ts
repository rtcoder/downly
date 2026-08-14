import type { DownloadRecord } from './types';

export type DownloadSortField = 'startTime' | 'filename' | 'size' | 'state' | 'category' | 'sourceDomain';
export type DownloadSortDirection = 'asc' | 'desc';

export interface DownloadSortOption {
  field: DownloadSortField;
  direction: DownloadSortDirection;
}

export const DOWNLOAD_SORTS = {
  startTimeDesc: { field: 'startTime', direction: 'desc' },
  startTimeAsc: { field: 'startTime', direction: 'asc' },
  filenameAsc: { field: 'filename', direction: 'asc' },
  filenameDesc: { field: 'filename', direction: 'desc' },
  sizeDesc: { field: 'size', direction: 'desc' },
  sizeAsc: { field: 'size', direction: 'asc' },
  stateAsc: { field: 'state', direction: 'asc' },
  categoryAsc: { field: 'category', direction: 'asc' },
  sourceDomainAsc: { field: 'sourceDomain', direction: 'asc' },
  sourceDomainDesc: { field: 'sourceDomain', direction: 'desc' },
} as const satisfies Record<string, DownloadSortOption>;

const stateOrder: Record<DownloadRecord['state'], number> = {
  in_progress: 0,
  complete: 1,
  interrupted: 2,
};

function sizeOf(download: DownloadRecord): number {
  return download.fileSize || download.totalBytes || download.bytesReceived;
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true });
}

function compareDownloads(
  left: DownloadRecord,
  right: DownloadRecord,
  option: DownloadSortOption,
): number {
  switch (option.field) {
    case 'startTime':
      return new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
    case 'filename':
      return compareStrings(left.basename || left.filename, right.basename || right.filename);
    case 'size':
      return sizeOf(left) - sizeOf(right);
    case 'state':
      return stateOrder[left.state] - stateOrder[right.state];
    case 'category':
      return compareStrings(left.category, right.category);
    case 'sourceDomain':
      return compareStrings(left.sourceDomain, right.sourceDomain);
  }
}

export function sortDownloads(
  downloads: readonly DownloadRecord[],
  option: DownloadSortOption = DOWNLOAD_SORTS.startTimeDesc,
): DownloadRecord[] {
  return downloads
    .map((download, index) => ({ download, index }))
    .sort((left, right) => {
      const compared = compareDownloads(left.download, right.download, option);
      const directed = option.direction === 'desc' ? -compared : compared;
      return directed || left.index - right.index;
    })
    .map(({ download }) => download);
}
