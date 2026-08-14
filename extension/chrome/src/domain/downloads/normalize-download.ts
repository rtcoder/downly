import { categorizeFile } from './categorize-file';
import { sourceDomainForUrls } from './source-domain';
import type { DownloadRecord, DownloadState } from './types';

export interface RawChromeDownload {
  id: number;
  filename?: string;
  mime?: string | null;
  state?: DownloadState;
  paused?: boolean;
  canResume?: boolean;
  exists?: boolean;
  danger?: string;
  error?: string | null;
  url?: string;
  finalUrl?: string | null;
  referrer?: string | null;
  bytesReceived?: number;
  totalBytes?: number;
  fileSize?: number;
  startTime: string;
  endTime?: string | null;
  estimatedEndTime?: string | null;
}

function filenameParts(filename: string): { basename: string; extension: string | null } {
  const leafName = filename.split(/[\\/]/).at(-1) ?? '';
  const extensionStart = leafName.lastIndexOf('.');

  if (extensionStart <= 0 || extensionStart === leafName.length - 1) {
    return { basename: leafName, extension: null };
  }

  return {
    basename: leafName.slice(0, extensionStart),
    extension: leafName.slice(extensionStart + 1).toLowerCase(),
  };
}

export function normalizeDownload(raw: RawChromeDownload): DownloadRecord {
  const filename = raw.filename ?? '';
  const { basename, extension } = filenameParts(filename);
  const mime = raw.mime ?? null;
  const finalUrl = raw.finalUrl ?? null;
  const referrer = raw.referrer ?? null;

  return {
    id: raw.id,
    filename,
    basename,
    extension,
    mime,
    category: categorizeFile(mime, extension),
    state: raw.state ?? 'in_progress',
    paused: raw.paused ?? false,
    canResume: raw.canResume ?? false,
    exists: raw.exists ?? false,
    danger: raw.danger ?? '',
    error: raw.error ?? null,
    url: raw.url ?? '',
    finalUrl,
    referrer,
    sourceDomain: sourceDomainForUrls(referrer, finalUrl, raw.url),
    bytesReceived: raw.bytesReceived ?? 0,
    totalBytes: raw.totalBytes ?? 0,
    fileSize: raw.fileSize ?? 0,
    startTime: raw.startTime,
    endTime: raw.endTime ?? null,
    estimatedEndTime: raw.estimatedEndTime ?? null,
  };
}
