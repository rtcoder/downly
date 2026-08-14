export interface ChromeDownloadItem {
  id: number;
  filename: string;
  url: string;
  startTime: string;
  finalUrl?: string | null;
  state?: 'in_progress' | 'interrupted' | 'complete';
  paused?: boolean;
  canResume?: boolean;
  exists?: boolean;
  danger?: string;
  error?: string | null;
  mime?: string | null;
  referrer?: string | null;
  bytesReceived?: number;
  totalBytes?: number;
  fileSize?: number;
  endTime?: string | null;
  estimatedEndTime?: string | null;
}

type Callback<T> = (result: T) => void;

export interface ChromeMock {
  runtime: { lastError?: { message?: string } };
  downloads: {
    search: (query: Record<string, unknown>, callback: Callback<ChromeDownloadItem[]>) => void | Promise<void>;
    pause: (id: number, callback: Callback<void>) => void | Promise<void>;
    resume: (id: number, callback: Callback<void>) => void | Promise<void>;
    cancel: (id: number, callback: Callback<void>) => void | Promise<void>;
    open: (id: number, callback: Callback<void>) => void | Promise<void>;
    show: (id: number) => void;
    showDefaultFolder: () => void;
    removeFile: (id: number, callback: Callback<void>) => void | Promise<void>;
    erase: (query: { id: number }, callback: Callback<number[]>) => void | Promise<void>;
    download: (
      options: { url: string; conflictAction: 'uniquify' },
      callback: Callback<number>,
    ) => void | Promise<void>;
  };
  calls: Array<{ method: string; args: unknown[] }>;
  results: {
    search: ChromeDownloadItem[];
    erase: number[];
    download: number;
  };
}

export function createChromeMock(): ChromeMock {
  const calls: ChromeMock['calls'] = [];
  const results: ChromeMock['results'] = { search: [], erase: [], download: 1 };
  const runtime: ChromeMock['runtime'] = {};

  function record(method: string, args: unknown[]): void {
    calls.push({ method, args });
  }

  function complete<T>(callback: Callback<T>, result: T): void {
    try {
      callback(result);
    } finally {
      delete runtime.lastError;
    }
  }

  return {
    runtime,
    results,
    calls,
    downloads: {
      search(query, callback) {
        record('search', [query]);
        complete(callback, results.search);
      },
      pause(id, callback) {
        record('pause', [id]);
        complete(callback, undefined);
      },
      resume(id, callback) {
        record('resume', [id]);
        complete(callback, undefined);
      },
      cancel(id, callback) {
        record('cancel', [id]);
        complete(callback, undefined);
      },
      open(id, callback) {
        record('open', [id]);
        complete(callback, undefined);
      },
      show(id) {
        record('show', [id]);
      },
      showDefaultFolder() {
        record('showDefaultFolder', []);
      },
      removeFile(id, callback) {
        record('removeFile', [id]);
        complete(callback, undefined);
      },
      erase(query, callback) {
        record('erase', [query]);
        complete(callback, results.erase);
      },
      download(options, callback) {
        record('download', [options]);
        complete(callback, results.download);
      },
    },
  };
}
