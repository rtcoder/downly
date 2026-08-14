import { describe, expect, it } from 'vitest';

import type { DownloadRecord } from '../../src/domain/downloads/types';
import { aggregateDownloadStats } from '../../src/domain/stats/aggregate-stats';

function download(overrides: Partial<DownloadRecord> = {}): DownloadRecord {
  return {
    id: 1,
    filename: '/downloads/report.pdf',
    basename: 'report',
    extension: 'pdf',
    mime: 'application/pdf',
    category: 'document',
    state: 'complete',
    paused: false,
    canResume: false,
    exists: true,
    danger: 'safe',
    error: null,
    url: 'https://docs.example/report.pdf',
    finalUrl: null,
    referrer: null,
    sourceDomain: 'docs.example',
    bytesReceived: 2_048,
    totalBytes: 2_048,
    fileSize: 2_048,
    startTime: '2026-08-14T10:00:00.000Z',
    endTime: '2026-08-14T10:01:00.000Z',
    estimatedEndTime: null,
    ...overrides,
  };
}

describe('aggregateDownloadStats', () => {
  it('filters range totals using the provided clock', () => {
    const downloads = [
      download({ id: 1, startTime: '2026-08-14T08:00:00.000Z', bytesReceived: 100 }),
      download({ id: 2, startTime: '2026-08-08T08:00:00.000Z', bytesReceived: 200 }),
      download({ id: 3, startTime: '2026-08-07T08:00:00.000Z', bytesReceived: 400 }),
      download({ id: 4, startTime: '2026-07-20T08:00:00.000Z', bytesReceived: 800 }),
      download({ id: 5, startTime: '2025-08-14T11:59:59.999Z', bytesReceived: 1_600 }),
    ];

    const sevenDays = aggregateDownloadStats(downloads, {
      range: '7-days',
      now: new Date('2026-08-14T12:00:00.000Z'),
    });
    const thirtyDays = aggregateDownloadStats(downloads, {
      range: '30-days',
      now: new Date('2026-08-14T12:00:00.000Z'),
    });
    const oneYear = aggregateDownloadStats(downloads, {
      range: '1-year',
      now: new Date('2026-08-14T12:00:00.000Z'),
    });
    const allHistory = aggregateDownloadStats(downloads, {
      range: 'all',
      now: new Date('2026-08-14T12:00:00.000Z'),
    });

    expect(sevenDays.range.count).toBe(2);
    expect(sevenDays.range.bytesReceived).toBe(300);
    expect(thirtyDays.range.count).toBe(4);
    expect(thirtyDays.range.bytesReceived).toBe(1_500);
    expect(oneYear.range.count).toBe(4);
    expect(allHistory.range.count).toBe(5);
  });

  it('counts downloads today and this month from available history', () => {
    const now = new Date(2026, 7, 14, 12);

    const stats = aggregateDownloadStats([
      download({ id: 1, startTime: new Date(2026, 7, 14, 10).toISOString() }),
      download({ id: 2, startTime: new Date(2026, 7, 13, 23, 59, 59, 999).toISOString() }),
      download({ id: 3, startTime: new Date(2026, 7, 1, 0).toISOString() }),
      download({ id: 4, startTime: new Date(2026, 6, 31, 23, 59, 59, 999).toISOString() }),
    ], {
      range: 'all',
      now,
    });

    expect(stats.downloadsToday).toBe(1);
    expect(stats.downloadsThisMonth).toBe(3);
    expect(stats.bytesByPeriod.map((bucket) => bucket.key)).toEqual(['2026-07', '2026-08']);
  });

  it('uses local day and month boundaries for today and this month counts', () => {
    const now = new Date(2026, 7, 14, 0, 30);
    const localToday = new Date(2026, 7, 14, 0, 10).toISOString();
    const localYesterday = new Date(2026, 7, 13, 23, 50).toISOString();
    const localMonth = new Date(2026, 7, 1, 0, 10).toISOString();
    const previousMonth = new Date(2026, 6, 31, 23, 50).toISOString();

    const stats = aggregateDownloadStats([
      download({ id: 1, startTime: localToday }),
      download({ id: 2, startTime: localYesterday }),
      download({ id: 3, startTime: localMonth }),
      download({ id: 4, startTime: previousMonth }),
    ], {
      range: 'all',
      now,
    });

    expect(stats.downloadsToday).toBe(1);
    expect(stats.downloadsThisMonth).toBe(3);
  });

  it('uses local day buckets for daily trend ranges', () => {
    const now = new Date(2026, 7, 14, 0, 30);
    const stats = aggregateDownloadStats([
      download({ id: 1, startTime: new Date(2026, 7, 14, 0, 10).toISOString() }),
      download({ id: 2, startTime: new Date(2026, 7, 13, 23, 50).toISOString() }),
    ], {
      range: '7-days',
      now,
    });

    expect(stats.bytesByPeriod.map((bucket) => bucket.key)).toEqual(['2026-08-13', '2026-08-14']);
  });

  it('totals bytes for selected range and current month using the best known size', () => {
    const stats = aggregateDownloadStats([
      download({ id: 1, startTime: '2026-08-14T08:00:00.000Z', fileSize: 4_096, totalBytes: 2_048, bytesReceived: 1_024 }),
      download({ id: 2, startTime: '2026-08-13T08:00:00.000Z', fileSize: 0, totalBytes: 8_192, bytesReceived: 4_096 }),
      download({ id: 3, startTime: '2026-07-20T08:00:00.000Z', fileSize: 0, totalBytes: 0, bytesReceived: 16_384 }),
    ], {
      range: '7-days',
      now: new Date('2026-08-14T12:00:00.000Z'),
    });

    expect(stats.range.bytesDownloaded).toBe(12_288);
    expect(stats.bytesDownloadedThisMonth).toBe(12_288);
  });

  it('uses received bytes for incomplete downloads instead of projected total size', () => {
    const stats = aggregateDownloadStats([
      download({
        id: 1,
        state: 'in_progress',
        fileSize: 0,
        totalBytes: 1_000_000,
        bytesReceived: 10_000,
      }),
      download({
        id: 2,
        state: 'interrupted',
        fileSize: 0,
        totalBytes: 500_000,
        bytesReceived: 25_000,
      }),
      download({
        id: 3,
        state: 'complete',
        fileSize: 100_000,
        totalBytes: 100_000,
        bytesReceived: 100_000,
      }),
    ], {
      range: '30-days',
      now: new Date('2026-08-14T12:00:00.000Z'),
    });

    expect(stats.range.bytesDownloaded).toBe(135_000);
  });

  it('counts completed and interrupted downloads in the selected range', () => {
    const stats = aggregateDownloadStats([
      download({ id: 1, state: 'complete' }),
      download({ id: 2, state: 'complete' }),
      download({ id: 3, state: 'interrupted', error: 'NETWORK_FAILED' }),
      download({ id: 4, state: 'in_progress' }),
      download({ id: 5, state: 'interrupted', startTime: '2026-07-10T08:00:00.000Z' }),
    ], {
      range: '30-days',
      now: new Date('2026-08-14T12:00:00.000Z'),
    });

    expect(stats.completedCount).toBe(2);
    expect(stats.interruptedCount).toBe(1);
  });

  it('finds the largest item in the selected range', () => {
    const small = download({ id: 1, basename: 'small', filename: '/downloads/small.pdf', fileSize: 1_024 });
    const largest = download({ id: 2, basename: 'movie', filename: '/downloads/movie.mp4', category: 'video', fileSize: 50_000 });
    const olderLargest = download({ id: 3, basename: 'old', filename: '/downloads/old.zip', fileSize: 100_000, startTime: '2026-01-01T08:00:00.000Z' });

    const stats = aggregateDownloadStats([small, largest, olderLargest], {
      range: '90-days',
      now: new Date('2026-08-14T12:00:00.000Z'),
    });

    expect(stats.largestItem).toEqual({
      id: 2,
      filename: '/downloads/movie.mp4',
      basename: 'movie',
      size: 50_000,
    });
  });

  it('selects top category and top domain with stable tie-breaking', () => {
    const stats = aggregateDownloadStats([
      download({ id: 1, category: 'video', sourceDomain: 'media.example' }),
      download({ id: 2, category: 'document', sourceDomain: 'docs.example' }),
      download({ id: 3, category: 'document', sourceDomain: 'docs.example' }),
      download({ id: 4, category: 'archive', sourceDomain: 'media.example' }),
    ], {
      range: 'all',
      now: new Date('2026-08-14T12:00:00.000Z'),
    });

    expect(stats.topCategory).toEqual({ key: 'document', label: 'Document', count: 2 });
    expect(stats.topDomain).toEqual({ key: 'docs.example', label: 'docs.example', count: 2 });
  });

  it('returns empty structures for empty history', () => {
    const stats = aggregateDownloadStats([], {
      range: 'all',
      now: new Date('2026-08-14T12:00:00.000Z'),
    });

    expect(stats.hasHistory).toBe(false);
    expect(stats.downloadsToday).toBe(0);
    expect(stats.downloadsThisMonth).toBe(0);
    expect(stats.range.count).toBe(0);
    expect(stats.range.bytesDownloaded).toBe(0);
    expect(stats.completedCount).toBe(0);
    expect(stats.interruptedCount).toBe(0);
    expect(stats.largestItem).toBeNull();
    expect(stats.topCategory).toBeNull();
    expect(stats.topDomain).toBeNull();
    expect(stats.bytesByPeriod).toEqual([]);
    expect(stats.countByCategory).toEqual([]);
    expect(stats.countByDomain).toEqual([]);
  });
});
