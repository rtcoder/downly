import type {ActiveDownloadMetrics} from '../../../application/active-download-sampler';
import type {DownloadActionService} from '../../../application/download-actions';
import type {DownloadTimeGroupId} from '../../../domain/downloads/group-downloads';
import {groupDownloadsByTime} from '../../../domain/downloads/group-downloads';
import type {DownloadRecord} from '../../../domain/downloads/types';
import {DownloadRow, EmptyState, type I18nKey, t} from '../../shared';
import type {ManagerGroupKey} from '../components/manager-options';

export interface DownloadsViewProps {
  downloads: DownloadRecord[];
  groupBy: ManagerGroupKey;
  loading: boolean;
  metrics: ActiveDownloadMetrics[];
  now: Date;
  downloadActions: DownloadActionService;
  onAction: (action: () => Promise<unknown> | void) => void;
  onEraseHistory: (download: DownloadRecord) => void;
}

export function DownloadsView({
                                downloads,
                                groupBy,
                                loading,
                                metrics,
                                now,
                                downloadActions,
                                onAction,
                                onEraseHistory,
                              }: DownloadsViewProps) {
  if (loading) {
    return <p>{t('manager.downloads.loading')}</p>;
  }

  if (downloads.length === 0) {
    return <EmptyState title={t('manager.downloads.emptyTitle')}
                       description={t('manager.downloads.emptyDescription')}/>;
  }

  if (groupBy === 'none') {
    return <section aria-label={t('manager.downloads.list')}>
      {downloads.map((download) => renderRow(download, metrics, downloadActions, onAction, onEraseHistory))}
    </section>;
  }

  return <section aria-label={t('manager.downloads.groupedList')}>
    {groupsFor(downloads, groupBy, now).map((group) => (
      <section aria-label={group.label} key={group.label}>
        <h2>{group.label}</h2>
        {group.downloads.map((download) => renderRow(download, metrics, downloadActions, onAction, onEraseHistory))}
      </section>
    ))}
  </section>;
}

function renderRow(
  download: DownloadRecord,
  metrics: ActiveDownloadMetrics[],
  downloadActions: DownloadActionService,
  onAction: (action: () => Promise<unknown> | void) => void,
  onEraseHistory: (download: DownloadRecord) => void,
) {
  return <DownloadRow
    download={download}
    key={download.id}
    metrics={metrics.find((metric) => metric.downloadId === download.id)}
    onCancel={() => onAction(() => downloadActions.cancel(download))}
    onCopyFinalUrl={() => onAction(() => downloadActions.copyFinalUrl(download))}
    onCopySourceUrl={() => onAction(() => downloadActions.copySourceUrl(download))}
    onDownloadAgain={() => onAction(() => downloadActions.downloadAgain(download))}
    onEraseHistory={() => onEraseHistory(download)}
    onOpen={() => onAction(() => downloadActions.open(download))}
    onPause={() => onAction(() => downloadActions.pause(download))}
    onRemoveFile={() => onAction(() => downloadActions.removeFile(download))}
    onResume={() => onAction(() => downloadActions.resume(download))}
    onRetry={() => onAction(() => downloadActions.retry(download))}
    onShowInFolder={() => onAction(() => downloadActions.showInFolder(download))}
  />;
}

function groupsFor(downloads: DownloadRecord[], groupBy: ManagerGroupKey, now: Date) {
  if (groupBy === 'time') {
    return groupDownloadsByTime(downloads, {now}).map((group) => ({
      ...group,
      label: t(timeGroupLabelKeys[group.id]),
    }));
  }

  const grouped = new Map<string, DownloadRecord[]>();
  for (const download of downloads) {
    const label = groupBy === 'category'
      ? labelFor(download.category)
      : download.sourceDomain || t('manager.downloads.unknownSource');
    grouped.set(label, [...(grouped.get(label) ?? []), download]);
  }

  return Array.from(grouped, ([label, groupedDownloads]) => ({
    id: label,
    label,
    downloads: groupedDownloads,
  }));
}

const timeGroupLabelKeys: Record<DownloadTimeGroupId, I18nKey> = {
  today: 'manager.group.today',
  yesterday: 'manager.group.yesterday',
  'earlier-this-week': 'manager.group.earlierThisWeek',
  'last-week': 'manager.group.lastWeek',
  older: 'manager.group.older',
};

function labelFor(value: string): string {
  return `${value.charAt(0).toLocaleUpperCase()}${value.slice(1)}`;
}
