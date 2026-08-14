import { DOWNLOAD_SORTS, type DownloadSortOption } from '../../../domain/downloads/sort-downloads';
import type { DownloadPredicate } from '../../../domain/downloads/filter-downloads';

export type ManagerView = DownloadPredicate;
export type ManagerSortKey =
  | 'startTimeDesc'
  | 'startTimeAsc'
  | 'sizeDesc'
  | 'sizeAsc'
  | 'filenameAsc'
  | 'filenameDesc'
  | 'sourceDomainAsc';
export type ManagerGroupKey = 'none' | 'time' | 'category' | 'domain';

export const MANAGER_VIEWS: Array<{ id: ManagerView; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
];

export const MANAGER_SORTS: Array<{ id: ManagerSortKey; label: string; option: DownloadSortOption }> = [
  { id: 'startTimeDesc', label: 'Newest first', option: DOWNLOAD_SORTS.startTimeDesc },
  { id: 'startTimeAsc', label: 'Oldest first', option: DOWNLOAD_SORTS.startTimeAsc },
  { id: 'sizeDesc', label: 'Largest first', option: DOWNLOAD_SORTS.sizeDesc },
  { id: 'sizeAsc', label: 'Smallest first', option: DOWNLOAD_SORTS.sizeAsc },
  { id: 'filenameAsc', label: 'Filename A-Z', option: DOWNLOAD_SORTS.filenameAsc },
  { id: 'filenameDesc', label: 'Filename Z-A', option: DOWNLOAD_SORTS.filenameDesc },
  { id: 'sourceDomainAsc', label: 'Source domain', option: DOWNLOAD_SORTS.sourceDomainAsc },
];

export const MANAGER_GROUPS: Array<{ id: ManagerGroupKey; label: string }> = [
  { id: 'none', label: 'No grouping' },
  { id: 'time', label: 'Time' },
  { id: 'category', label: 'File type' },
  { id: 'domain', label: 'Source domain' },
];

export function sortOptionFor(key: ManagerSortKey): DownloadSortOption {
  return MANAGER_SORTS.find((sort) => sort.id === key)?.option ?? DOWNLOAD_SORTS.startTimeDesc;
}
