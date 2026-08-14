import { describe, expect, it } from 'vitest';

import { ActiveDownloadSampler } from '../../src/application/active-download-sampler';
import type { DownloadRecord } from '../../src/domain/downloads/types';

function download(overrides: Partial<DownloadRecord> = {}): DownloadRecord {
  return {
    id: 1,
    filename: 'download.bin',
    basename: 'download',
    extension: 'bin',
    mime: 'application/octet-stream',
    category: 'other',
    state: 'in_progress',
    paused: false,
    canResume: false,
    exists: true,
    danger: 'safe',
    error: null,
    url: 'https://example.com/download.bin',
    finalUrl: null,
    referrer: null,
    sourceDomain: 'example.com',
    bytesReceived: 0,
    totalBytes: 4_000,
    fileSize: 4_000,
    startTime: '2026-08-14T00:00:00.000Z',
    endTime: null,
    estimatedEndTime: null,
    ...overrides,
  };
}

describe('ActiveDownloadSampler', () => {
  it('returns null speed and ETA for an active download first sample', () => {
    const sampler = new ActiveDownloadSampler();

    expect(sampler.sample([download({ bytesReceived: 1_000 })], 1_000)).toEqual([{
      downloadId: 1,
      bytesPerSecond: null,
      etaSeconds: null,
    }]);
  });

  it('calculates speed from the received-byte delta and elapsed time', () => {
    const sampler = new ActiveDownloadSampler();
    sampler.sample([download({ bytesReceived: 500 })], 1_000);

    expect(sampler.sample([download({ bytesReceived: 1_500, totalBytes: 3_500 })], 2_000)).toEqual([{
      downloadId: 1,
      bytesPerSecond: 1_000,
      etaSeconds: 2,
    }]);
  });

  it('does not calculate speed when timestamps have no elapsed time', () => {
    const sampler = new ActiveDownloadSampler();
    sampler.sample([download({ bytesReceived: 500 })], 1_000);

    expect(sampler.sample([download({ bytesReceived: 1_500 })], 1_000)).toEqual([{
      downloadId: 1,
      bytesPerSecond: null,
      etaSeconds: null,
    }]);
  });

  it('does not let a negative byte delta contaminate the next valid speed sample', () => {
    const sampler = new ActiveDownloadSampler();
    sampler.sample([download({ bytesReceived: 1_000 })], 1_000);

    expect(sampler.sample([download({ bytesReceived: 500 })], 2_000)).toEqual([{
      downloadId: 1,
      bytesPerSecond: null,
      etaSeconds: null,
    }]);
    expect(sampler.sample([download({ bytesReceived: 1_500 })], 3_000)).toEqual([{
      downloadId: 1,
      bytesPerSecond: 1_000,
      etaSeconds: 2.5,
    }]);
  });

  it('smooths subsequent instantaneous speeds with EWMA', () => {
    const sampler = new ActiveDownloadSampler();
    sampler.sample([download({ bytesReceived: 0 })], 0);
    sampler.sample([download({ bytesReceived: 1_000 })], 1_000);

    expect(sampler.sample([download({ bytesReceived: 4_000, totalBytes: 9_000 })], 2_000)).toEqual([{
      downloadId: 1,
      bytesPerSecond: 1_500,
      etaSeconds: 10 / 3,
    }]);
  });

  it('removes completed downloads from metrics and cached samples', () => {
    const sampler = new ActiveDownloadSampler();
    sampler.sample([download({ bytesReceived: 500 })], 1_000);

    expect(sampler.sample([download({ state: 'complete', bytesReceived: 4_000 })], 2_000)).toEqual([]);
    expect(sampler.sample([download({ bytesReceived: 2_000 })], 3_000)).toEqual([{
      downloadId: 1,
      bytesPerSecond: null,
      etaSeconds: null,
    }]);
  });

  it('returns no ETA when Chrome does not report a positive totalBytes', () => {
    const sampler = new ActiveDownloadSampler();
    sampler.sample([download({ bytesReceived: 0, totalBytes: 0, fileSize: 4_000 })], 0);

    expect(sampler.sample([download({ bytesReceived: 1_000, totalBytes: 0, fileSize: 4_000 })], 1_000)).toEqual([{
      downloadId: 1,
      bytesPerSecond: 1_000,
      etaSeconds: null,
    }]);
  });

  it('prefers valid Chrome estimatedEndTime and falls back when it is invalid or stale', () => {
    const sampler = new ActiveDownloadSampler();
    sampler.sample([download({ bytesReceived: 0 })], 1_000);

    expect(sampler.sample([download({
      bytesReceived: 1_000,
      estimatedEndTime: '1970-01-01T00:00:01.500Z',
    })], 1_000)).toEqual([{
      downloadId: 1,
      bytesPerSecond: null,
      etaSeconds: 0.5,
    }]);
    expect(sampler.sample([download({
      bytesReceived: 2_000,
      estimatedEndTime: 'not-a-date',
    })], 2_000)).toEqual([{
      downloadId: 1,
      bytesPerSecond: 1_000,
      etaSeconds: 2,
    }]);
    expect(sampler.sample([download({
      bytesReceived: 3_000,
      estimatedEndTime: '1970-01-01T00:00:01.000Z',
    })], 3_000)).toEqual([{
      downloadId: 1,
      bytesPerSecond: 1_000,
      etaSeconds: 1,
    }]);
  });
});
