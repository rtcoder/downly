import type {DownloadState, FileCategory} from '../../../domain/downloads/types';
import {type I18nKey, t} from '../../shared';
import {MANAGER_GROUPS, MANAGER_SORTS, type ManagerGroupKey, type ManagerSortKey} from './manager-options';

export interface ManagerFilterState {
  state: '' | DownloadState;
  category: '' | FileCategory;
  extension: string;
  sourceDomain: string;
  startedAfter: string;
  startedBefore: string;
  minSize: string;
  maxSize: string;
  availability: '' | 'exists' | 'missing';
}

export const EMPTY_MANAGER_FILTERS: ManagerFilterState = {
  state: '',
  category: '',
  extension: '',
  sourceDomain: '',
  startedAfter: '',
  startedBefore: '',
  minSize: '',
  maxSize: '',
  availability: '',
};

export interface ManagerFiltersProps {
  filters: ManagerFilterState;
  groupBy: ManagerGroupKey;
  sortBy: ManagerSortKey;
  onFiltersChange: (filters: ManagerFilterState) => void;
  onGroupByChange: (groupBy: ManagerGroupKey) => void;
  onSortByChange: (sortBy: ManagerSortKey) => void;
}

const categories: FileCategory[] = ['image', 'video', 'audio', 'document', 'archive', 'installer', 'code', 'other'];
const categoryLabelKeys: Record<FileCategory, I18nKey> = {
  archive: 'manager.filters.category.archive',
  audio: 'manager.filters.category.audio',
  code: 'manager.filters.category.code',
  document: 'manager.filters.category.document',
  image: 'manager.filters.category.image',
  installer: 'manager.filters.category.installer',
  other: 'manager.filters.category.other',
  video: 'manager.filters.category.video',
};

export function ManagerFilters({
                                 filters,
                                 groupBy,
                                 sortBy,
                                 onFiltersChange,
                                 onGroupByChange,
                                 onSortByChange,
                               }: ManagerFiltersProps) {
  const update = <K extends keyof ManagerFilterState>(key: K, value: ManagerFilterState[K]) => {
    onFiltersChange({...filters, [key]: value});
  };

  return <form aria-label={t('manager.filters.form')} className="manager-filter-form">
    <label className="manager-filter-field">
      <span>{t('manager.filters.sort')}</span>
      <select
        aria-label={t('manager.filters.sort')}
        onChange={(event) => onSortByChange(event.currentTarget.value as ManagerSortKey)}
        value={sortBy}
      >
        {MANAGER_SORTS.map((sort) => <option key={sort.id} value={sort.id}>{sort.label}</option>)}
      </select>
    </label>
    <label className="manager-filter-field">
      <span>{t('manager.filters.group')}</span>
      <select
        aria-label={t('manager.filters.group')}
        onChange={(event) => onGroupByChange(event.currentTarget.value as ManagerGroupKey)}
        value={groupBy}
      >
        {MANAGER_GROUPS.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
      </select>
    </label>
    <label className="manager-filter-field manager-filter-field--small">
      <span>{t('manager.filters.state')}</span>
      <select
        aria-label={t('manager.filters.stateFilter')}
        onChange={(event) => update('state', event.currentTarget.value as ManagerFilterState['state'])}
        value={filters.state}
      >
        <option value="">{t('manager.filters.anyState')}</option>
        <option value="in_progress">{t('manager.filters.active')}</option>
        <option value="complete">{t('manager.filters.completed')}</option>
        <option value="interrupted">{t('manager.filters.failed')}</option>
      </select>
    </label>
    <label className="manager-filter-field manager-filter-field--small">
      <span>{t('manager.filters.category')}</span>
      <select
        aria-label={t('manager.filters.categoryFilter')}
        onChange={(event) => update('category', event.currentTarget.value as ManagerFilterState['category'])}
        value={filters.category}
      >
        <option value="">{t('manager.filters.anyCategory')}</option>
        {categories.map((category) => <option key={category}
                                              value={category}>{t(categoryLabelKeys[category])}</option>)}
      </select>
    </label>
    <label className="manager-filter-field manager-filter-field--tiny">
      <span>{t('manager.filters.extension')}</span>
      <input
        aria-label={t('manager.filters.extensionFilter')}
        onChange={(event) => update('extension', event.currentTarget.value)}
        value={filters.extension}
      />
    </label>
    <label className="manager-filter-field">
      <span>{t('manager.filters.sourceDomain')}</span>
      <input
        aria-label={t('manager.filters.sourceDomainFilter')}
        onChange={(event) => update('sourceDomain', event.currentTarget.value)}
        value={filters.sourceDomain}
      />
    </label>
    <label className="manager-filter-field manager-filter-field--date">
      <span>{t('manager.filters.startedAfter')}</span>
      <input
        aria-label={t('manager.filters.startedAfterFilter')}
        onChange={(event) => update('startedAfter', event.currentTarget.value)}
        type="date"
        value={filters.startedAfter}
      />
    </label>
    <label className="manager-filter-field manager-filter-field--date">
      <span>{t('manager.filters.startedBefore')}</span>
      <input
        aria-label={t('manager.filters.startedBeforeFilter')}
        onChange={(event) => update('startedBefore', event.currentTarget.value)}
        type="date"
        value={filters.startedBefore}
      />
    </label>
    <label className="manager-filter-field manager-filter-field--tiny">
      <span>{t('manager.filters.minSize')}</span>
      <input
        aria-label={t('manager.filters.minSizeFilter')}
        min="0"
        onChange={(event) => update('minSize', event.currentTarget.value)}
        type="number"
        value={filters.minSize}
      />
    </label>
    <label className="manager-filter-field manager-filter-field--tiny">
      <span>{t('manager.filters.maxSize')}</span>
      <input
        aria-label={t('manager.filters.maxSizeFilter')}
        min="0"
        onChange={(event) => update('maxSize', event.currentTarget.value)}
        type="number"
        value={filters.maxSize}
      />
    </label>
    <label className="manager-filter-field manager-filter-field--small">
      <span>{t('manager.filters.availability')}</span>
      <select
        aria-label={t('manager.filters.availabilityFilter')}
        onChange={(event) => update('availability', event.currentTarget.value as ManagerFilterState['availability'])}
        value={filters.availability}
      >
        <option value="">{t('manager.filters.anyAvailability')}</option>
        <option value="exists">{t('manager.filters.fileExists')}</option>
        <option value="missing">{t('manager.filters.fileMissing')}</option>
      </select>
    </label>
  </form>;
}
