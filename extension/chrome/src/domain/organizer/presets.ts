import type { FileCategory } from '../downloads/types';
import type { DownloadRule } from './types';

const presetDefinitions: ReadonlyArray<{ id: string; name: string; category: FileCategory; priority: number }> = [
  { id: 'images', name: 'Images', category: 'image', priority: 10 },
  { id: 'videos', name: 'Videos', category: 'video', priority: 20 },
  { id: 'audio', name: 'Audio', category: 'audio', priority: 30 },
  { id: 'documents', name: 'Documents', category: 'document', priority: 40 },
  { id: 'archives', name: 'Archives', category: 'archive', priority: 50 },
  { id: 'installers', name: 'Installers', category: 'installer', priority: 60 },
  { id: 'code', name: 'Code', category: 'code', priority: 70 },
  { id: 'other', name: 'Other', category: 'other', priority: 80 },
];

export const BUILT_IN_ORGANIZER_PRESETS: DownloadRule[] = presetDefinitions.map(({ id, name, category, priority }) => ({
  id: `preset-${id}`,
  name,
  enabled: false,
  priority,
  conditions: [{ field: 'category', operator: 'equals', value: category }],
  targetPathTemplate: `${name}/`,
}));
