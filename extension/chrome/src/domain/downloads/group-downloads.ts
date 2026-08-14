import type { DownloadRecord } from './types';

export type DownloadTimeGroupId =
  | 'today'
  | 'yesterday'
  | 'earlier-this-week'
  | 'last-week'
  | 'older';

export interface DownloadTimeGroup {
  id: DownloadTimeGroupId;
  label: string;
  downloads: DownloadRecord[];
}

export interface GroupDownloadsByTimeOptions {
  now?: Date;
}

const groupDefinitions: Array<{ id: DownloadTimeGroupId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'earlier-this-week', label: 'Earlier this week' },
  { id: 'last-week', label: 'Last week' },
  { id: 'older', label: 'Older' },
];

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function startOfLocalWeek(date: Date): Date {
  const day = date.getDay();
  const daysSinceMonday = (day + 6) % 7;
  return addDays(startOfLocalDay(date), -daysSinceMonday);
}

function groupIdFor(startTime: string, now: Date): DownloadTimeGroupId {
  const timestamp = new Date(startTime).getTime();
  const today = startOfLocalDay(now).getTime();
  const tomorrow = addDays(startOfLocalDay(now), 1).getTime();
  const yesterday = addDays(startOfLocalDay(now), -1).getTime();
  const thisWeek = startOfLocalWeek(now).getTime();
  const lastWeek = addDays(new Date(thisWeek), -7).getTime();

  if (timestamp >= today && timestamp < tomorrow) return 'today';
  if (timestamp >= yesterday && timestamp < today) return 'yesterday';
  if (timestamp >= thisWeek && timestamp < yesterday) return 'earlier-this-week';
  if (timestamp >= lastWeek && timestamp < thisWeek) return 'last-week';
  return 'older';
}

export function groupDownloadsByTime(
  downloads: readonly DownloadRecord[],
  options: GroupDownloadsByTimeOptions = {},
): DownloadTimeGroup[] {
  const now = options.now ?? new Date();
  const groups = new Map<DownloadTimeGroupId, DownloadRecord[]>(
    groupDefinitions.map(({ id }) => [id, []]),
  );

  for (const download of downloads) {
    groups.get(groupIdFor(download.startTime, now))?.push(download);
  }

  return groupDefinitions
    .map(({ id, label }) => ({ id, label, downloads: groups.get(id) ?? [] }))
    .filter((group) => group.downloads.length > 0);
}
