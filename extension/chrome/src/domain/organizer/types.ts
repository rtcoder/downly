export type { DownloadRule, RuleCondition, RuleField, RuleOperator } from '../settings/types';

export type ConflictAction = 'uniquify' | 'overwrite' | 'prompt';

export interface FilenameSuggestion {
  filename: string;
  conflictAction: ConflictAction;
  ruleId: string;
}

export interface RuleValidationError {
  conditionIndex: number;
  message: string;
}
