import type { ActiveDownloadMetrics } from '../../../application/active-download-sampler';
import type { DownloadRecord } from '../../../domain/downloads/types';
import { formatDateTime, formatSourceDomain } from '../formatters';
import { DownloadActions, type DownloadActionsProps } from './DownloadActions';
import { DownloadProgress } from './DownloadProgress';
import { DownloadStatus } from './DownloadStatus';
import { FileCategoryIcon } from './FileCategoryIcon';
import { displayFilename } from './download-helpers';

export interface DownloadRowProps extends Omit<DownloadActionsProps, 'download'> {
  download: DownloadRecord;
  metrics?: ActiveDownloadMetrics | null;
}

export function DownloadRow({ download, metrics, ...actions }: DownloadRowProps) {
  const filename = displayFilename(download);

  return <article aria-label={filename}>
    <FileCategoryIcon category={download.category} />
    <div className="download-row-details">
      <h3 title={filename}>{filename}</h3>
      <span>{formatSourceDomain(download)}</span>
      <time dateTime={download.startTime}>{formatDateTime(download.startTime)}</time>
    </div>
    <div className="download-row-progress">
      <DownloadStatus download={download} />
      <DownloadProgress download={download} metrics={metrics} />
    </div>
    <DownloadActions download={download} {...actions} />
  </article>;
}
