import type { DownloadState, FileCategory } from '../../../domain/downloads/types';
import { MANAGER_GROUPS, MANAGER_SORTS, type ManagerGroupKey, type ManagerSortKey } from './manager-options';

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

export function ManagerFilters({
  filters,
  groupBy,
  sortBy,
  onFiltersChange,
  onGroupByChange,
  onSortByChange,
}: ManagerFiltersProps) {
  const update = <K extends keyof ManagerFilterState>(key: K, value: ManagerFilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return <form aria-label="Manager query controls">
    <label>
      <span>Sort downloads</span>
      <select
        aria-label="Sort downloads"
        onChange={(event) => onSortByChange(event.currentTarget.value as ManagerSortKey)}
        value={sortBy}
      >
        {MANAGER_SORTS.map((sort) => <option key={sort.id} value={sort.id}>{sort.label}</option>)}
      </select>
    </label>
    <label>
      <span>Group downloads</span>
      <select
        aria-label="Group downloads"
        onChange={(event) => onGroupByChange(event.currentTarget.value as ManagerGroupKey)}
        value={groupBy}
      >
        {MANAGER_GROUPS.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
      </select>
    </label>
    <label>
      <span>State</span>
      <select
        aria-label="State filter"
        onChange={(event) => update('state', event.currentTarget.value as ManagerFilterState['state'])}
        value={filters.state}
      >
        <option value="">Any state</option>
        <option value="in_progress">Active</option>
        <option value="complete">Completed</option>
        <option value="interrupted">Failed</option>
      </select>
    </label>
    <label>
      <span>Category</span>
      <select
        aria-label="Category filter"
        onChange={(event) => update('category', event.currentTarget.value as ManagerFilterState['category'])}
        value={filters.category}
      >
        <option value="">Any category</option>
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
    </label>
    <label>
      <span>Extension</span>
      <input
        aria-label="Extension filter"
        onChange={(event) => update('extension', event.currentTarget.value)}
        value={filters.extension}
      />
    </label>
    <label>
      <span>Source domain</span>
      <input
        aria-label="Source domain filter"
        onChange={(event) => update('sourceDomain', event.currentTarget.value)}
        value={filters.sourceDomain}
      />
    </label>
    <label>
      <span>Started after</span>
      <input
        aria-label="Started after filter"
        onChange={(event) => update('startedAfter', event.currentTarget.value)}
        type="date"
        value={filters.startedAfter}
      />
    </label>
    <label>
      <span>Started before</span>
      <input
        aria-label="Started before filter"
        onChange={(event) => update('startedBefore', event.currentTarget.value)}
        type="date"
        value={filters.startedBefore}
      />
    </label>
    <label>
      <span>Minimum size</span>
      <input
        aria-label="Minimum size filter"
        min="0"
        onChange={(event) => update('minSize', event.currentTarget.value)}
        type="number"
        value={filters.minSize}
      />
    </label>
    <label>
      <span>Maximum size</span>
      <input
        aria-label="Maximum size filter"
        min="0"
        onChange={(event) => update('maxSize', event.currentTarget.value)}
        type="number"
        value={filters.maxSize}
      />
    </label>
    <label>
      <span>File availability</span>
      <select
        aria-label="File availability filter"
        onChange={(event) => update('availability', event.currentTarget.value as ManagerFilterState['availability'])}
        value={filters.availability}
      >
        <option value="">Any availability</option>
        <option value="exists">File exists</option>
        <option value="missing">File missing</option>
      </select>
    </label>
  </form>;
}
