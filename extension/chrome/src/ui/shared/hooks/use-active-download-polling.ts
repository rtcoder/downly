import {useCallback, useEffect, useMemo, useState} from 'react';

import {type ActiveDownloadMetrics, ActiveDownloadSampler} from '../../../application/active-download-sampler';
import type {DownloadsPort} from '../../../application/download-repository';
import type {DownloadRecord} from '../../../domain/downloads/types';

export interface UseActiveDownloadPollingResult {
  metrics: ActiveDownloadMetrics[];
}

export function useActiveDownloadPolling(
  downloadsPort: DownloadsPort,
  activeDownloads: DownloadRecord[],
  onActiveDownloads: (downloads: DownloadRecord[]) => void,
): UseActiveDownloadPollingResult {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  const [metrics, setMetrics] = useState<ActiveDownloadMetrics[]>([]);
  const sampler = useMemo(() => new ActiveDownloadSampler(), []);
  const hasActiveDownloads = activeDownloads.some((download) => download.state === 'in_progress');

  const sample = useCallback((downloads: DownloadRecord[]) => {
    setMetrics(sampler.sample(downloads, Date.now()));
  }, [sampler]);

  useEffect(() => {
    sample(activeDownloads);
  }, [activeDownloads, sample]);

  useEffect(() => {
    const onVisibilityChange = () => setVisible(document.visibilityState === 'visible');

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!visible || !hasActiveDownloads) {
      return undefined;
    }

    let active = true;
    const pollActiveDownloads = async () => {
      const downloads = await downloadsPort.search({state: 'in_progress'});
      if (active) {
        onActiveDownloads(downloads);
      }
    };

    const intervalId = window.setInterval(() => {
      void pollActiveDownloads();
    }, 1_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [downloadsPort, hasActiveDownloads, onActiveDownloads, visible]);

  return {metrics};
}
