import type { DownloadRecord, DownloadState } from '../domain/downloads/types';

export interface DownloadSearchQuery {
  state?: DownloadState;
  startedAfter?: string;
  startedBefore?: string;
  limit?: number;
  orderBy?: string[];
}

export interface DownloadsPort {
  search(query: DownloadSearchQuery): Promise<DownloadRecord[]>;
  getById(id: number): Promise<DownloadRecord | null>;
  pause(id: number): Promise<void>;
  resume(id: number): Promise<void>;
  cancel(id: number): Promise<void>;
  open(id: number): Promise<void>;
  show(id: number): void;
  showDefaultFolder(): void;
  removeFile(id: number): Promise<void>;
  eraseById(id: number): Promise<number[]>;
  downloadAgain(record: DownloadRecord): Promise<number>;
}
