import { describe, expect, it } from 'vitest';

import {
  formatBytes,
  formatDateTime,
  formatDuration,
  formatEta,
  formatSourceDomain,
  formatSpeed,
} from '../../src/ui/shared';

describe('shared formatters', () => {
  it('formats byte counts with binary units and unknown fallbacks', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1_024)).toBe('1.0 KB');
    expect(formatBytes(1_572_864)).toBe('1.5 MB');
    expect(formatBytes(null)).toBe('Unknown size');
    expect(formatBytes(-1)).toBe('Unknown size');
  });

  it('formats transfer speed as bytes per second with idle fallback', () => {
    expect(formatSpeed(null)).toBe('Idle');
    expect(formatSpeed(0)).toBe('Idle');
    expect(formatSpeed(512)).toBe('512 B/s');
    expect(formatSpeed(1_048_576)).toBe('1.0 MB/s');
  });

  it('formats duration and ETA from seconds', () => {
    expect(formatDuration(null)).toBe('Unknown time');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(65)).toBe('1m 05s');
    expect(formatDuration(3_661)).toBe('1h 01m');
    expect(formatEta(90)).toBe('ETA 1m 30s');
    expect(formatEta(null)).toBe('ETA unknown');
  });

  it('formats date and time in a caller supplied time zone', () => {
    expect(formatDateTime('2026-08-14T10:05:00.000Z', { timeZone: 'UTC' })).toBe('Aug 14, 2026, 10:05');
    expect(formatDateTime(null, { timeZone: 'UTC' })).toBe('Unknown date');
    expect(formatDateTime('not-a-date', { timeZone: 'UTC' })).toBe('Unknown date');
  });

  it('uses a stored source domain and falls back to URLs before unknown source', () => {
    expect(formatSourceDomain({
      sourceDomain: 'docs.example',
      referrer: 'https://referrer.example/article',
      finalUrl: 'https://cdn.example/file.zip',
      url: 'https://origin.example/file.zip',
    })).toBe('docs.example');
    expect(formatSourceDomain({
      sourceDomain: 'unknown',
      referrer: null,
      finalUrl: 'https://cdn.example/file.zip',
      url: 'https://origin.example/file.zip',
    })).toBe('cdn.example');
    expect(formatSourceDomain({
      sourceDomain: '',
      referrer: 'not a URL',
      finalUrl: null,
      url: 'also not a URL',
    })).toBe('Unknown source');
  });
});
