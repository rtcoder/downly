import type { DownloadRecord } from './types';

export function normalizeDownloadSearchQuery(query: string): string[] {
  return query
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/\s+/)
    .filter(Boolean);
}

function searchableText(download: DownloadRecord): string {
  return [
    download.filename,
    download.basename,
    download.extension,
    download.mime,
    download.category,
    download.state,
    download.sourceDomain,
    download.url,
    download.finalUrl,
    download.referrer,
    download.danger,
    download.error,
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function searchDownloads(downloads: readonly DownloadRecord[], query: string): DownloadRecord[] {
  const tokens = normalizeDownloadSearchQuery(query);

  if (tokens.length === 0) {
    return [...downloads];
  }

  return downloads.filter((download) => {
    const haystack = searchableText(download);
    return tokens.every((token) => haystack.includes(token));
  });
}
