import type { DownloadRecord } from '../domain/downloads/types';

export interface ActiveDownloadMetrics {
  downloadId: number;
  bytesPerSecond: number | null;
  etaSeconds: number | null;
}

interface DownloadSample {
  timestampMs: number;
  bytesReceived: number;
  smoothedBytesPerSecond: number | null;
}

export class ActiveDownloadSampler {
  private readonly samples = new Map<number, DownloadSample>();

  constructor(private readonly alpha = 0.25) {}

  sample(downloads: DownloadRecord[], timestampMs: number): ActiveDownloadMetrics[] {
    const activeDownloads = downloads.filter((download) => download.state === 'in_progress');
    const activeIds = new Set(activeDownloads.map((download) => download.id));

    for (const downloadId of this.samples.keys()) {
      if (!activeIds.has(downloadId)) {
        this.samples.delete(downloadId);
      }
    }

    return activeDownloads.map((download) => this.sampleDownload(download, timestampMs));
  }

  private sampleDownload(download: DownloadRecord, timestampMs: number): ActiveDownloadMetrics {
    const previous = this.samples.get(download.id);
    const estimatedEta = estimatedEtaSeconds(download.estimatedEndTime, timestampMs);

    if (!previous) {
      this.samples.set(download.id, {
        timestampMs,
        bytesReceived: download.bytesReceived,
        smoothedBytesPerSecond: null,
      });
      return this.metricsFor(download, null, estimatedEta);
    }

    const elapsedMs = timestampMs - previous.timestampMs;
    const receivedBytes = download.bytesReceived - previous.bytesReceived;

    if (elapsedMs <= 0 || receivedBytes < 0) {
      this.samples.set(download.id, {
        timestampMs,
        bytesReceived: download.bytesReceived,
        smoothedBytesPerSecond: previous.smoothedBytesPerSecond,
      });
      return this.metricsFor(download, null, estimatedEta);
    }

    const instantaneousBytesPerSecond = receivedBytes / (elapsedMs / 1_000);
    const bytesPerSecond = previous.smoothedBytesPerSecond === null
      ? instantaneousBytesPerSecond
      : this.alpha * instantaneousBytesPerSecond + (1 - this.alpha) * previous.smoothedBytesPerSecond;

    this.samples.set(download.id, {
      timestampMs,
      bytesReceived: download.bytesReceived,
      smoothedBytesPerSecond: bytesPerSecond,
    });

    return this.metricsFor(download, bytesPerSecond, estimatedEta);
  }

  private metricsFor(
    download: DownloadRecord,
    bytesPerSecond: number | null,
    estimatedEta: number | null,
  ): ActiveDownloadMetrics {
    const etaSeconds = estimatedEta ?? calculatedEtaSeconds(download, bytesPerSecond);

    return {
      downloadId: download.id,
      bytesPerSecond,
      etaSeconds,
    };
  }
}

function estimatedEtaSeconds(estimatedEndTime: string | null, timestampMs: number): number | null {
  if (!estimatedEndTime) {
    return null;
  }

  const estimatedEndTimeMs = Date.parse(estimatedEndTime);
  return Number.isFinite(estimatedEndTimeMs)
    ? Math.max(0, (estimatedEndTimeMs - timestampMs) / 1_000)
    : null;
}

function calculatedEtaSeconds(download: DownloadRecord, bytesPerSecond: number | null): number | null {
  if (download.totalBytes <= 0 || !bytesPerSecond || bytesPerSecond <= 0) {
    return null;
  }

  return Math.max(0, download.totalBytes - download.bytesReceived) / bytesPerSecond;
}
