import type {
  DownloadStats,
  StatsAggregationOptions,
  StatsDownload,
  StatsLargestItem,
  StatsPeriodBucket,
  StatsRange,
  StatsTopItem,
} from './types';
import { FILE_CATEGORY_LABELS, STATS_RANGES } from './types';

const DAY_MS = 24 * 60 * 60 * 1_000;

export function aggregateDownloadStats(
  downloads: readonly StatsDownload[],
  options: StatsAggregationOptions = {},
): DownloadStats {
  const now = options.now ?? new Date();
  const range = options.range ?? '30-days';
  const rangeDownloads = downloads.filter((download) => isInRange(download, range, now));
  const monthDownloads = downloads.filter((download) => isInCurrentLocalMonth(download, now));

  const countByCategory = countBy(
    rangeDownloads,
    (download) => download.category,
    (category) => FILE_CATEGORY_LABELS[category],
  );
  const countByDomain = countBy(
    rangeDownloads,
    (download) => download.sourceDomain || 'Unknown source',
    (domain) => domain,
  ).slice(0, 10);
  const stateCounts = {
    completed: rangeDownloads.filter((download) => download.state === 'complete').length,
    interrupted: rangeDownloads.filter((download) => download.state === 'interrupted').length,
    inProgress: rangeDownloads.filter((download) => download.state === 'in_progress').length,
  };

  return {
    hasHistory: downloads.length > 0,
    range: {
      range,
      label: labelForRange(range),
      count: rangeDownloads.length,
      bytesReceived: sumBytes(rangeDownloads, (download) => download.bytesReceived),
      bytesDownloaded: sumBytes(rangeDownloads, downloadedBytes),
    },
    downloadsToday: downloads.filter((download) => isInCurrentLocalDay(download, now)).length,
    downloadsThisMonth: monthDownloads.length,
    bytesDownloadedThisMonth: sumBytes(monthDownloads, downloadedBytes),
    completedCount: stateCounts.completed,
    interruptedCount: stateCounts.interrupted,
    stateCounts,
    largestItem: largestItem(rangeDownloads),
    topCategory: countByCategory[0] ?? null,
    topDomain: countByDomain[0] ?? null,
    bytesByPeriod: bytesByPeriod(rangeDownloads, range),
    countByCategory,
    countByDomain,
  };
}

export function bestKnownSize(download: StatsDownload): number {
  return firstPositive(download.fileSize, download.totalBytes, download.bytesReceived);
}

export function downloadedBytes(download: StatsDownload): number {
  return download.state === 'complete' ? bestKnownSize(download) : firstPositive(download.bytesReceived);
}

function isInRange(download: StatsDownload, range: StatsRange, now: Date): boolean {
  if (range === 'all') {
    return validTimestamp(download.startTime) !== null;
  }

  const startedAt = validTimestamp(download.startTime);
  if (startedAt === null) {
    return false;
  }

  return startedAt >= rangeStartTime(range, now) && startedAt <= now.getTime();
}

function rangeStartTime(range: Exclude<StatsRange, 'all'>, now: Date): number {
  if (range === '1-year') {
    const start = new Date(now.getTime());
    start.setUTCFullYear(start.getUTCFullYear() - 1);
    return start.getTime();
  }

  const days = range === '7-days'
    ? 7
    : range === '30-days'
      ? 30
      : 90;
  return now.getTime() - days * DAY_MS;
}

function isInCurrentLocalDay(download: StatsDownload, now: Date): boolean {
  const startedAt = validTimestamp(download.startTime);
  if (startedAt === null) {
    return false;
  }

  const start = startOfLocalDay(now).getTime();
  const end = addLocalDays(startOfLocalDay(now), 1).getTime();
  return startedAt >= start && startedAt < end;
}

function isInCurrentLocalMonth(download: StatsDownload, now: Date): boolean {
  const startedAt = validTimestamp(download.startTime);
  if (startedAt === null) {
    return false;
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  return startedAt >= start && startedAt < end;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function validTimestamp(value: string): number | null {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function sumBytes(
  downloads: readonly StatsDownload[],
  valueFor: (download: StatsDownload) => number,
): number {
  return downloads.reduce((total, download) => total + Math.max(0, valueFor(download)), 0);
}

function firstPositive(...values: number[]): number {
  return values.find((value) => Number.isFinite(value) && value > 0) ?? 0;
}

function largestItem(downloads: readonly StatsDownload[]): StatsLargestItem | null {
  const largest = downloads.reduce<StatsDownload | null>((candidate, download) => {
    if (!candidate) {
      return download;
    }

    return bestKnownSize(download) > bestKnownSize(candidate) ? download : candidate;
  }, null);

  if (!largest) {
    return null;
  }

  return {
    id: largest.id,
    filename: largest.filename,
    basename: largest.basename,
    size: bestKnownSize(largest),
  };
}

function countBy<Key extends string>(
  downloads: readonly StatsDownload[],
  keyFor: (download: StatsDownload) => Key,
  labelFor: (key: Key) => string,
): StatsTopItem[] {
  const counts = new Map<Key, number>();
  for (const download of downloads) {
    const key = keyFor(download);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts, ([key, count]) => ({ key, label: labelFor(key), count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function bytesByPeriod(downloads: readonly StatsDownload[], range: StatsRange): StatsPeriodBucket[] {
  const buckets = new Map<string, StatsPeriodBucket>();
  const useMonth = range === '1-year' || range === 'all';

  for (const download of downloads) {
    const startedAt = validTimestamp(download.startTime);
    if (startedAt === null) {
      continue;
    }

    const date = new Date(startedAt);
    const key = useMonth
      ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
      : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const label = useMonth
      ? date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const current = buckets.get(key) ?? { key, label, bytesDownloaded: 0, count: 0 };

    buckets.set(key, {
      ...current,
      bytesDownloaded: current.bytesDownloaded + downloadedBytes(download),
      count: current.count + 1,
    });
  }

  return Array.from(buckets.values()).sort((left, right) => left.key.localeCompare(right.key));
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function labelForRange(range: StatsRange): string {
  return STATS_RANGES.find((option) => option.id === range)?.label ?? 'Available history';
}
