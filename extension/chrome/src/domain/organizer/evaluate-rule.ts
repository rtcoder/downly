import type { DownloadRecord } from '../downloads/types';
import type { DownloadRule, RuleCondition, RuleValidationError } from './types';

export function evaluateRule(record: DownloadRecord, rule: DownloadRule): boolean {
  return rule.enabled && rule.conditions.every((condition) => conditionMatches(record, condition));
}

export function validateRule(rule: DownloadRule): RuleValidationError | null {
  for (const [conditionIndex, condition] of rule.conditions.entries()) {
    if (condition.operator !== 'regex' || typeof condition.value !== 'string') continue;

    try {
      new RegExp(condition.value);
    } catch {
      return { conditionIndex, message: 'Invalid regular expression' };
    }
  }

  return null;
}

function conditionMatches(record: DownloadRecord, condition: RuleCondition): boolean {
  const fieldValue = record[condition.field];
  const value = typeof fieldValue === 'string' ? fieldValue : '';

  switch (condition.operator) {
    case 'equals':
      return typeof condition.value === 'string' && value === condition.value;
    case 'contains':
      return typeof condition.value === 'string' && value.includes(condition.value);
    case 'startsWith':
      return typeof condition.value === 'string' && value.startsWith(condition.value);
    case 'endsWith':
      return typeof condition.value === 'string' && value.endsWith(condition.value);
    case 'oneOf':
      return Array.isArray(condition.value) && condition.value.includes(value);
    case 'regex':
      if (typeof condition.value !== 'string') return false;
      try {
        return new RegExp(condition.value).test(value);
      } catch {
        return false;
      }
  }
}
