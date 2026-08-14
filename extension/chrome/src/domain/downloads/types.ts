export type DownloadState = 'in_progress' | 'interrupted' | 'complete';

export type FileCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'installer'
  | 'code'
  | 'other';

export interface DownloadRecord {
  id: number;
  filename: string;
  basename: string;
  extension: string | null;
  mime: string | null;
  category: FileCategory;
  state: DownloadState;
  paused: boolean;
  canResume: boolean;
  exists: boolean;
  danger: string;
  error: string | null;
  url: string;
  finalUrl: string | null;
  referrer: string | null;
  sourceDomain: string;
  bytesReceived: number;
  totalBytes: number;
  fileSize: number;
  startTime: string;
  endTime: string | null;
  estimatedEndTime: string | null;
}
