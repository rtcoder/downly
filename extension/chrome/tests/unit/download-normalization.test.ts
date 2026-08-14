import { describe, expect, it } from 'vitest';

import { normalizeDownload } from '../../src/domain/downloads/normalize-download';

describe('normalizeDownload', () => {
  it('extracts a lowercased final extension and basename from a path-like filename', () => {
    const download = normalizeDownload({
      id: 1,
      filename: 'C:\\Downloads\\release.notes.TAR.GZ',
      url: 'https://example.com/release',
      startTime: '2026-08-14T10:00:00.000Z',
    });

    expect(download.filename).toBe('C:\\Downloads\\release.notes.TAR.GZ');
    expect(download.basename).toBe('release.notes.TAR');
    expect(download.extension).toBe('gz');
    expect(download.category).toBe('archive');
  });

  it('keeps hidden dotfiles, trailing dots, and missing filenames extensionless', () => {
    const hiddenFile = normalizeDownload({
      id: 2,
      filename: '/tmp/.env',
      url: 'https://example.com/.env',
      startTime: '2026-08-14T10:00:00.000Z',
    });
    const trailingDot = normalizeDownload({
      id: 3,
      filename: 'report.',
      url: 'https://example.com/report.',
      startTime: '2026-08-14T10:00:00.000Z',
    });
    const missingFilename = normalizeDownload({
      id: 4,
      url: 'https://example.com/download',
      startTime: '2026-08-14T10:00:00.000Z',
    });

    expect(hiddenFile).toMatchObject({ basename: '.env', extension: null });
    expect(trailingDot).toMatchObject({ basename: 'report.', extension: null });
    expect(missingFilename).toMatchObject({ filename: '', basename: '', extension: null });
  });

  it('treats query-like text in a filename as part of its extension', () => {
    const download = normalizeDownload({
      id: 5,
      filename: 'report.csv?download=1',
      url: 'https://example.com/download',
      startTime: '2026-08-14T10:00:00.000Z',
    });

    expect(download.basename).toBe('report');
    expect(download.extension).toBe('csv?download=1');
  });

  it('uses a specific MIME type before the filename extension', () => {
    const download = normalizeDownload({
      id: 6,
      filename: 'photo.jpg',
      mime: 'application/pdf; charset=binary',
      url: 'https://example.com/photo.jpg',
      startTime: '2026-08-14T10:00:00.000Z',
    });

    expect(download.category).toBe('document');
  });

  it('falls back to the extension when MIME is generic', () => {
    const download = normalizeDownload({
      id: 7,
      filename: 'backup.ZIP',
      mime: 'application/octet-stream',
      url: 'https://example.com/backup',
      startTime: '2026-08-14T10:00:00.000Z',
    });

    expect(download.category).toBe('archive');
  });

  it('uses valid referrer, final URL, then original URL for source domain', () => {
    const referrerDomain = normalizeDownload({
      id: 8,
      filename: 'file.txt',
      url: 'https://origin.example/download',
      finalUrl: 'https://cdn.example/file.txt',
      referrer: 'https://Docs.Example/article',
      startTime: '2026-08-14T10:00:00.000Z',
    });
    const finalUrlDomain = normalizeDownload({
      id: 9,
      filename: 'file.txt',
      url: 'https://origin.example/download',
      finalUrl: 'https://cdn.example/file.txt',
      referrer: 'not a URL',
      startTime: '2026-08-14T10:00:00.000Z',
    });
    const originalUrlDomain = normalizeDownload({
      id: 10,
      filename: 'file.txt',
      url: 'https://Origin.Example/download',
      finalUrl: 'not a URL',
      startTime: '2026-08-14T10:00:00.000Z',
    });

    expect(referrerDomain.sourceDomain).toBe('docs.example');
    expect(finalUrlDomain.sourceDomain).toBe('cdn.example');
    expect(originalUrlDomain.sourceDomain).toBe('origin.example');
  });

  it('returns unknown when every URL field is missing or malformed', () => {
    const download = normalizeDownload({
      id: 11,
      filename: 'unknown',
      url: 'not a URL',
      finalUrl: '://bad',
      referrer: '',
      startTime: '2026-08-14T10:00:00.000Z',
    });

    expect(download.sourceDomain).toBe('unknown');
  });

  it('normalizes optional record fields to stable defaults', () => {
    const download = normalizeDownload({
      id: 12,
      filename: 'notes.txt',
      url: 'https://example.com/notes.txt',
      startTime: '2026-08-14T10:00:00.000Z',
    });

    expect(download).toMatchObject({
      state: 'in_progress',
      paused: false,
      canResume: false,
      exists: false,
      danger: '',
      error: null,
      finalUrl: null,
      referrer: null,
      mime: null,
      bytesReceived: 0,
      totalBytes: 0,
      fileSize: 0,
      endTime: null,
      estimatedEndTime: null,
    });
  });
});
