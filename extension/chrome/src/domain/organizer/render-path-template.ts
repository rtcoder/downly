import type { DownloadRecord } from '../downloads/types';

const tokenPattern = /\{(year|month|day|domain|category|extension|filename|basename)\}/g;

export function renderPathTemplate(template: string, record: DownloadRecord): string {
  const date = new Date(record.startTime);
  const tokens: Record<string, string> = {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1).padStart(2, '0'),
    day: String(date.getUTCDate()).padStart(2, '0'),
    domain: record.sourceDomain,
    category: record.category,
    extension: record.extension ?? '',
    filename: record.filename.split(/[\\/]/).at(-1) ?? '',
    basename: record.basename,
  };

  return template.replace(tokenPattern, (_token, name: string) => tokens[name]);
}
