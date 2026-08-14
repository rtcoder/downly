import type { ActiveDownloadMetrics } from '../../../application/active-download-sampler';
import type { DownloadsPort } from '../../../application/download-repository';
import type { DownloadRecord } from '../../../domain/downloads/types';
import { groupDownloadsByTime } from '../../../domain/downloads/group-downloads';
import { DownloadRow, EmptyState } from '../../shared';
import type { ManagerGroupKey } from '../components/manager-options';

export interface DownloadsViewProps {
  downloads: DownloadRecord[];
  groupBy: ManagerGroupKey;
  loading: boolean;
  metrics: ActiveDownloadMetrics[];
  now: Date;
  downloadsPort: DownloadsPort;
}

export function DownloadsView({ downloads, groupBy, loading, metrics, now, downloadsPort }: DownloadsViewProps) {
  if (loading) {
    return <p>Loading downloads...</p>;
  }

  if (downloads.length === 0) {
    return <EmptyState title="No matching downloads" description="Adjust search or filters to see more history." />;
  }

  if (groupBy === 'none') {
    return <section aria-label="Download list">
      {downloads.map((download) => renderRow(download, metrics, downloadsPort))}
    </section>;
  }

  return <section aria-label="Grouped downloads">
    {groupsFor(downloads, groupBy, now).map((group) => (
      <section aria-label={group.label} key={group.label}>
        <h2>{group.label}</h2>
        {group.downloads.map((download) => renderRow(download, metrics, downloadsPort))}
      </section>
    ))}
  </section>;
}

function renderRow(download: DownloadRecord, metrics: ActiveDownloadMetrics[], downloadsPort: DownloadsPort) {
  return <DownloadRow
    download={download}
    key={download.id}
    metrics={metrics.find((metric) => metric.downloadId === download.id)}
    onCancel={(downloadId) => void downloadsPort.cancel(downloadId)}
    onOpen={(downloadId) => void downloadsPort.open(downloadId)}
    onPause={(downloadId) => void downloadsPort.pause(downloadId)}
    onResume={(downloadId) => void downloadsPort.resume(downloadId)}
    onShowInFolder={(downloadId) => downloadsPort.show(downloadId)}
  />;
}

function groupsFor(downloads: DownloadRecord[], groupBy: ManagerGroupKey, now: Date) {
  if (groupBy === 'time') {
    return groupDownloadsByTime(downloads, { now });
  }

  const grouped = new Map<string, DownloadRecord[]>();
  for (const download of downloads) {
    const label = groupBy === 'category'
      ? labelFor(download.category)
      : download.sourceDomain || 'Unknown source';
    grouped.set(label, [...(grouped.get(label) ?? []), download]);
  }

  return Array.from(grouped, ([label, groupedDownloads]) => ({
    id: label,
    label,
    downloads: groupedDownloads,
  }));
}

function labelFor(value: string): string {
  return `${value.charAt(0).toLocaleUpperCase()}${value.slice(1)}`;
}
