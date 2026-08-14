import type { DownloadRecord, FileCategory } from '../downloads/types';

export type StatsRange = '7-days' | '30-days' | '90-days' | '1-year' | 'all';

export interface StatsAggregationOptions {
  range?: StatsRange;
  now?: Date;
}

export interface StatsRangeSummary {
  range: StatsRange;
  label: string;
  count: number;
  bytesReceived: number;
  bytesDownloaded: number;
}

export interface StatsTopItem {
  key: string;
  label: string;
  count: number;
}

export interface StatsLargestItem {
  id: number;
  filename: string;
  basename: string;
  size: number;
}

export interface StatsPeriodBucket {
  key: string;
  label: string;
  bytesDownloaded: number;
  count: number;
}

export interface StatsStateCounts {
  completed: number;
  interrupted: number;
  inProgress: number;
}

export interface DownloadStats {
  hasHistory: boolean;
  range: StatsRangeSummary;
  downloadsToday: number;
  downloadsThisMonth: number;
  bytesDownloadedThisMonth: number;
  completedCount: number;
  interruptedCount: number;
  stateCounts: StatsStateCounts;
  largestItem: StatsLargestItem | null;
  topCategory: StatsTopItem | null;
  topDomain: StatsTopItem | null;
  bytesByPeriod: StatsPeriodBucket[];
  countByCategory: StatsTopItem[];
  countByDomain: StatsTopItem[];
}

export type StatsDownload = Pick<
  DownloadRecord,
  | 'id'
  | 'filename'
  | 'basename'
  | 'category'
  | 'state'
  | 'sourceDomain'
  | 'bytesReceived'
  | 'totalBytes'
  | 'fileSize'
  | 'startTime'
>;

export const STATS_RANGES: Array<{ id: StatsRange; label: string }> = [
  { id: '7-days', label: '7 days' },
  { id: '30-days', label: '30 days' },
  { id: '90-days', label: '90 days' },
  { id: '1-year', label: '1 year' },
  { id: 'all', label: 'Available history' },
];

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
  archive: 'Archive',
  installer: 'Installer',
  code: 'Code',
  other: 'Other',
};
