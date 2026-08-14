import { DOWNLOAD_SORTS, type DownloadSortOption } from '../../../domain/downloads/sort-downloads';
import type { DownloadPredicate } from '../../../domain/downloads/filter-downloads';
import { t } from '../../shared/i18n';

export type ManagerView = DownloadPredicate | 'duplicates' | 'statistics' | 'organizer' | 'settings';
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
  { id: 'all', label: t('manager.sidebar.all') },
  { id: 'active', label: t('manager.sidebar.active') },
  { id: 'completed', label: t('manager.sidebar.completed') },
  { id: 'failed', label: t('manager.sidebar.failed') },
  { id: 'duplicates', label: t('manager.sidebar.duplicates') },
  { id: 'statistics', label: t('manager.sidebar.statistics') },
  { id: 'organizer', label: t('manager.sidebar.organizer') },
  { id: 'settings', label: t('manager.sidebar.settings') },
];

export const MANAGER_SORTS: Array<{ id: ManagerSortKey; label: string; option: DownloadSortOption }> = [
  { id: 'startTimeDesc', label: t('manager.sort.newest'), option: DOWNLOAD_SORTS.startTimeDesc },
  { id: 'startTimeAsc', label: t('manager.sort.oldest'), option: DOWNLOAD_SORTS.startTimeAsc },
  { id: 'sizeDesc', label: t('manager.sort.largest'), option: DOWNLOAD_SORTS.sizeDesc },
  { id: 'sizeAsc', label: t('manager.sort.smallest'), option: DOWNLOAD_SORTS.sizeAsc },
  { id: 'filenameAsc', label: t('manager.sort.filenameAsc'), option: DOWNLOAD_SORTS.filenameAsc },
  { id: 'filenameDesc', label: t('manager.sort.filenameDesc'), option: DOWNLOAD_SORTS.filenameDesc },
  { id: 'sourceDomainAsc', label: t('manager.sort.sourceDomain'), option: DOWNLOAD_SORTS.sourceDomainAsc },
];

export const MANAGER_GROUPS: Array<{ id: ManagerGroupKey; label: string }> = [
  { id: 'none', label: t('manager.group.none') },
  { id: 'time', label: t('manager.group.time') },
  { id: 'category', label: t('manager.group.category') },
  { id: 'domain', label: t('manager.group.domain') },
];

export function sortOptionFor(key: ManagerSortKey): DownloadSortOption {
  return MANAGER_SORTS.find((sort) => sort.id === key)?.option ?? DOWNLOAD_SORTS.startTimeDesc;
}
