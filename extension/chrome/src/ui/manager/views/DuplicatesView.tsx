import {
  detectPossibleDuplicates,
  type DuplicateMatch,
} from '../../../domain/downloads/duplicate-detector';
import type { DownloadRecord } from '../../../domain/downloads/types';
import { EmptyState } from '../../shared';
import { displayFilename } from '../../shared/components/download-helpers';

export interface DuplicatesViewProps {
  downloads: DownloadRecord[];
  loading: boolean;
  onShowMatchingDownload: (download: DownloadRecord) => void;
}

interface DuplicateGroup {
  candidate: DownloadRecord;
  matches: DuplicateMatch[];
}

export function DuplicatesView({
  downloads,
  loading,
  onShowMatchingDownload,
}: DuplicatesViewProps) {
  if (loading) {
    return <p>Loading possible duplicates...</p>;
  }

  const groups = groupPossibleDuplicates(downloads);

  if (groups.length === 0) {
    return <EmptyState
      title="No possible duplicates"
      description="Downly did not find possible duplicate downloads in the current list."
    />;
  }

  return <section aria-label="Possible duplicate downloads">
    {groups.map((group) => (
      <section
        aria-label={`Possible duplicate ${displayFilename(group.candidate)}`}
        key={group.candidate.id}
      >
        <p>Possible duplicate</p>
        <h2>{displayFilename(group.candidate)}</h2>
        <ol>
          {group.matches.map((match) => (
            <li key={match.item.id}>
              <strong>{displayFilename(match.item)}</strong>
              <span>{match.confidence} confidence</span>
              <ul>
                {match.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              <button
                aria-label={`Show matching download ${displayFilename(match.item)}`}
                onClick={() => onShowMatchingDownload(match.item)}
                type="button"
              >
                Show matching download
              </button>
            </li>
          ))}
        </ol>
      </section>
    ))}
  </section>;
}

function groupPossibleDuplicates(downloads: readonly DownloadRecord[]): DuplicateGroup[] {
  return downloads
    .map((candidate) => ({
      candidate,
      matches: detectPossibleDuplicates(candidate, downloads)
        .filter((match) => compareDownloadRecency(candidate, match.item) >= 0),
    }))
    .filter((group) => group.matches.length > 0)
    .sort((left, right) => compareDownloadRecency(right.candidate, left.candidate));
}

function compareDownloadRecency(left: DownloadRecord, right: DownloadRecord): number {
  const timeCompare = timestampFor(left) - timestampFor(right);
  if (timeCompare !== 0) {
    return timeCompare;
  }

  return left.id - right.id;
}

function timestampFor(download: DownloadRecord): number {
  const timestamp = new Date(download.startTime).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
