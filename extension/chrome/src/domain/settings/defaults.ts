import type { DownlySettings } from './types';

export const DEFAULT_SETTINGS: DownlySettings = {
  schemaVersion: 1,
  theme: 'system',
  language: 'auto',
  replaceNativeDownloadsUi: false,
  showActiveCountBadge: true,
  organizerEnabled: false,
  conflictAction: 'uniquify',
  rules: [],
};
