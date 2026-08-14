import { describe, expect, it } from 'vitest';

import {
  detectPossibleDuplicates,
  normalizeDuplicateUrl,
  type DuplicateConfidence,
} from '../../src/domain/downloads/duplicate-detector';
import type { DownloadRecord } from '../../src/domain/downloads/types';

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

function confidences(matches: ReturnType<typeof detectPossibleDuplicates>): DuplicateConfidence[] {
  return matches.map((match) => match.confidence);
}

describe('detectPossibleDuplicates', () => {
  it('reports strong confidence for same basename, extension, known size, and normalized URL', () => {
    const current = download({
      id: 10,
      url: 'https://Docs.Example/download/report.pdf?utm_source=newsletter&b=2&a=1#section',
      finalUrl: 'https://cdn.example/report.pdf?Expires=123&Signature=abc',
      startTime: '2026-08-14T12:00:00.000Z',
    });
    const candidate = download({
      id: 11,
      url: 'https://docs.example/download/report.pdf?a=1&b=2',
      finalUrl: 'https://cdn.example/report.pdf',
      startTime: '2026-08-14T11:00:00.000Z',
    });

    const matches = detectPossibleDuplicates(current, [candidate]);

    expect(confidences(matches)).toEqual(['strong']);
    expect(matches[0]).toMatchObject({
      item: candidate,
      confidence: 'strong',
      reasons: [
        'Same filename',
        'Same extension',
        'Same known size',
        'Same normalized source URL',
        'Same normalized final URL',
      ],
    });
  });

  it('reports medium confidence for same final URL when size is unknown', () => {
    const current = download({
      id: 20,
      fileSize: 0,
      totalBytes: 0,
      bytesReceived: 0,
      url: 'https://docs.example/file/report.pdf',
      finalUrl: 'https://cdn.example/file/report.pdf',
    });
    const candidate = download({
      id: 21,
      fileSize: 0,
      totalBytes: 0,
      bytesReceived: 0,
      url: 'https://mirror.example/file/report.pdf',
      finalUrl: 'https://cdn.example/file/report.pdf',
      startTime: '2026-08-14T09:00:00.000Z',
    });

    const matches = detectPossibleDuplicates(current, [candidate]);

    expect(confidences(matches)).toEqual(['medium']);
    expect(matches[0].reasons).not.toContain('Same known size');
  });

  it('reports strong confidence for same final URL and same known file size with different filenames', () => {
    const current = download({
      id: 22,
      basename: 'invoice-final',
      filename: '/downloads/invoice-final.pdf',
      url: 'https://docs.example/files/invoice-final.pdf',
      finalUrl: 'https://cdn.example/files/shared.pdf',
      fileSize: 4_096,
      totalBytes: 4_096,
    });
    const candidate = download({
      id: 23,
      basename: 'renamed-copy',
      filename: '/downloads/renamed-copy.pdf',
      url: 'https://mirror.example/files/renamed-copy.pdf',
      finalUrl: 'https://cdn.example/files/shared.pdf#ignored',
      fileSize: 4_096,
      totalBytes: 4_096,
    });

    const matches = detectPossibleDuplicates(current, [candidate]);

    expect(confidences(matches)).toEqual(['strong']);
    expect(matches[0].reasons).toEqual(['Same known size', 'Same normalized final URL']);
  });

  it('reports strong confidence for same filename, known size, and source domain without matching URLs', () => {
    const current = download({
      id: 24,
      url: 'https://docs.example/downloads/one/report.pdf',
      finalUrl: null,
      fileSize: 8_192,
      totalBytes: 8_192,
    });
    const candidate = download({
      id: 25,
      url: 'https://docs.example/downloads/two/report.pdf',
      finalUrl: null,
      sourceDomain: 'docs.example',
      fileSize: 8_192,
      totalBytes: 8_192,
    });

    const matches = detectPossibleDuplicates(current, [candidate]);

    expect(confidences(matches)).toEqual(['strong']);
    expect(matches[0].reasons).toEqual(['Same filename', 'Same extension', 'Same known size', 'Same source domain']);
  });

  it('reports medium confidence for same final URL when size is unknown and filename differs', () => {
    const current = download({
      id: 26,
      basename: 'download',
      filename: '/downloads/download.pdf',
      finalUrl: 'https://cdn.example/shared.pdf',
      fileSize: 0,
      totalBytes: 0,
      bytesReceived: 0,
    });
    const candidate = download({
      id: 27,
      basename: 'receipt',
      filename: '/downloads/receipt.pdf',
      finalUrl: 'https://cdn.example/shared.pdf',
      fileSize: 0,
      totalBytes: 0,
      bytesReceived: 0,
    });

    expect(confidences(detectPossibleDuplicates(current, [candidate]))).toEqual(['medium']);
  });

  it('reports medium confidence for same filename and same known size from a different source', () => {
    const current = download({
      id: 28,
      url: 'https://docs.example/report.pdf',
      finalUrl: null,
      fileSize: 1_024,
      totalBytes: 1_024,
    });
    const candidate = download({
      id: 29,
      url: 'https://mirror.example/report.pdf',
      finalUrl: null,
      sourceDomain: 'mirror.example',
      fileSize: 1_024,
      totalBytes: 1_024,
    });

    expect(confidences(detectPossibleDuplicates(current, [candidate]))).toEqual(['medium']);
  });

  it('reports weak confidence for matching basename and extension from a different source', () => {
    const candidate = download({
      id: 31,
      url: 'https://mirror.example/report.pdf',
      finalUrl: 'https://mirror.example/files/report.pdf',
      sourceDomain: 'mirror.example',
      fileSize: 0,
      totalBytes: 0,
      bytesReceived: 0,
    });

    expect(confidences(detectPossibleDuplicates(
      download({ id: 30, url: 'https://docs.example/report.pdf', fileSize: 0, totalBytes: 0, bytesReceived: 0 }),
      [candidate],
    ))).toEqual(['weak']);
  });

  it('does not turn unknown equal sizes into a strong size match', () => {
    const current = download({
      id: 40,
      fileSize: 0,
      totalBytes: 0,
      bytesReceived: 0,
      url: 'https://docs.example/report.pdf',
      finalUrl: 'https://cdn.example/report.pdf',
    });
    const candidate = download({
      id: 41,
      fileSize: 0,
      totalBytes: 0,
      bytesReceived: 0,
      url: 'https://mirror.example/report.pdf',
      finalUrl: 'https://cdn.example/report.pdf',
    });

    expect(detectPossibleDuplicates(current, [candidate])[0].confidence).toBe('medium');
  });

  it('excludes self-comparison even when the same record is present in candidates', () => {
    const current = download({ id: 50 });

    expect(detectPossibleDuplicates(current, [current])).toEqual([]);
  });

  it('normalizes URLs by lowercasing host, stripping hashes, removing tracking params, and sorting query params', () => {
    expect(normalizeDuplicateUrl('https://Docs.Example/path/file.pdf?utm_medium=email&b=2&a=1#download')).toBe(
      'https://docs.example/path/file.pdf?a=1&b=2',
    );
  });

  it('orders plausible matches by confidence, then most recent candidate deterministically', () => {
    const current = download({
      id: 60,
      finalUrl: 'https://cdn.example/report.pdf',
      startTime: '2026-08-14T12:00:00.000Z',
    });
    const oldMedium = download({
      id: 61,
      url: 'https://docs.example/report.pdf',
      fileSize: 0,
      totalBytes: 0,
      bytesReceived: 0,
      finalUrl: 'https://cdn.example/report.pdf',
      startTime: '2026-08-13T12:00:00.000Z',
    });
    const newestMedium = download({
      id: 62,
      url: 'https://docs.example/report.pdf',
      fileSize: 0,
      totalBytes: 0,
      bytesReceived: 0,
      finalUrl: 'https://cdn.example/report.pdf',
      startTime: '2026-08-14T11:00:00.000Z',
    });
    const weak = download({
      id: 63,
      url: 'https://other.example/report.pdf',
      sourceDomain: 'other.example',
      fileSize: 0,
      totalBytes: 0,
      bytesReceived: 0,
      startTime: '2026-08-14T11:30:00.000Z',
    });

    const matches = detectPossibleDuplicates(current, [oldMedium, weak, newestMedium]);

    expect(matches.map((match) => match.item.id)).toEqual([62, 61, 63]);
    expect(confidences(matches)).toEqual(['medium', 'medium', 'weak']);
  });
});
