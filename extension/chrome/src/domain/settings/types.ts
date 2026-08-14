export type RuleOperator = 'equals' | 'endsWith' | 'contains' | 'startsWith' | 'regex' | 'oneOf';

export type RuleField = 'sourceDomain' | 'filename' | 'extension' | 'mime' | 'category';

export interface RuleCondition {
  field: RuleField;
  operator: RuleOperator;
  value: string | string[];
}

export interface DownloadRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: RuleCondition[];
  targetPathTemplate: string;
}

export interface DownlySettings {
  schemaVersion: 1;
  theme: 'system' | 'light' | 'dark';
  language: 'auto' | 'en' | 'pl';
  replaceNativeDownloadsUi: boolean;
  showActiveCountBadge: boolean;
  organizerEnabled: boolean;
  conflictAction: 'uniquify' | 'overwrite' | 'prompt';
  rules: DownloadRule[];
}
