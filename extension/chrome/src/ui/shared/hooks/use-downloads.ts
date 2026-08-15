import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DownloadSearchQuery, DownloadsPort } from '../../../application/download-repository';
import type { DownloadRecord } from '../../../domain/downloads/types';

export interface RuntimeMessageSource {
  addListener(listener: (message: unknown) => void): void;
  removeListener(listener: (message: unknown) => void): void;
}

export interface UseDownloadsResult {
  downloads: DownloadRecord[];
  loading: boolean;
  refresh: () => Promise<void>;
  replaceActiveDownloads: (activeDownloads: DownloadRecord[]) => void;
}

const ACTIVE_DOWNLOADS_QUERY: DownloadSearchQuery = { state: 'in_progress' };
const RECENT_DOWNLOADS_QUERY: DownloadSearchQuery = { limit: 50, orderBy: ['-startTime'] };

export function useDownloads(
  downloadsPort: DownloadsPort,
  runtimeMessages?: RuntimeMessageSource,
): UseDownloadsResult {
  const [activeDownloads, setActiveDownloads] = useState<DownloadRecord[]>([]);
  const [recentDownloads, setRecentDownloads] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshSequence = useRef(0);

  const refresh = useCallback(async (options: { showLoading?: boolean } = {}) => {
    const showLoading = options.showLoading ?? true;
    const sequence = refreshSequence.current + 1;
    refreshSequence.current = sequence;
    if (showLoading) {
      setLoading(true);
    }
    const [active, recent] = await Promise.all([
      downloadsPort.search(ACTIVE_DOWNLOADS_QUERY),
      downloadsPort.search(RECENT_DOWNLOADS_QUERY),
    ]);

    if (refreshSequence.current !== sequence) {
      return;
    }

    setActiveDownloads(active);
    setRecentDownloads(recent);
    setLoading(false);
  }, [downloadsPort]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!runtimeMessages) {
      return undefined;
    }

    const listener = (message: unknown) => {
      if (isDownloadsInvalidatedMessage(message)) {
        void refresh({ showLoading: false });
      }
    };

    runtimeMessages.addListener(listener);

    return () => runtimeMessages.removeListener(listener);
  }, [refresh, runtimeMessages]);

  const downloads = useMemo(
    () => mergeActiveFirst(activeDownloads, recentDownloads),
    [activeDownloads, recentDownloads],
  );

  return {
    downloads,
    loading,
    refresh,
    replaceActiveDownloads: setActiveDownloads,
  };
}

function mergeActiveFirst(activeDownloads: DownloadRecord[], recentDownloads: DownloadRecord[]): DownloadRecord[] {
  const activeIds = new Set(activeDownloads.map((download) => download.id));
  return [
    ...activeDownloads,
    ...recentDownloads.filter((download) => !activeIds.has(download.id)),
  ];
}

function isDownloadsInvalidatedMessage(message: unknown): message is { type: 'downloads-invalidated' } {
  return (
    typeof message === 'object'
    && message !== null
    && 'type' in message
    && message.type === 'downloads-invalidated'
  );
}
