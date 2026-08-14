import { DEFAULT_SETTINGS } from './defaults';
import type { DownloadRule, DownlySettings, RuleCondition, RuleField, RuleOperator } from './types';

const RULE_OPERATORS: readonly RuleOperator[] = ['equals', 'endsWith', 'contains', 'startsWith', 'regex', 'oneOf'];
const RULE_FIELDS: readonly RuleField[] = ['sourceDomain', 'filename', 'extension', 'mime', 'category'];

export function migrateSettings(input: unknown): DownlySettings {
  const persisted = asRecord(input);

  return {
    schemaVersion: 1,
    theme: enumValue(persisted?.theme, ['system', 'light', 'dark'], DEFAULT_SETTINGS.theme),
    language: enumValue(persisted?.language, ['auto', 'en', 'pl'], DEFAULT_SETTINGS.language),
    replaceNativeDownloadsUi: booleanValue(persisted?.replaceNativeDownloadsUi, DEFAULT_SETTINGS.replaceNativeDownloadsUi),
    showActiveCountBadge: booleanValue(persisted?.showActiveCountBadge, DEFAULT_SETTINGS.showActiveCountBadge),
    organizerEnabled: booleanValue(persisted?.organizerEnabled, DEFAULT_SETTINGS.organizerEnabled),
    conflictAction: enumValue(persisted?.conflictAction, ['uniquify', 'overwrite', 'prompt'], DEFAULT_SETTINGS.conflictAction),
    rules: rulesValue(persisted?.rules),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function rulesValue(value: unknown): DownloadRule[] {
  return Array.isArray(value) ? value.map(ruleValue).filter((rule): rule is DownloadRule => rule !== null) : [];
}

function ruleValue(value: unknown): DownloadRule | null {
  const rule = asRecord(value);
  const rawConditions = rule?.conditions;
  const inputConditionCount = Array.isArray(rawConditions) ? rawConditions.length : null;
  const conditions = Array.isArray(rawConditions)
    ? rawConditions.map(conditionValue).filter((condition): condition is RuleCondition => condition !== null)
    : null;

  if (
    !rule ||
    typeof rule.id !== 'string' ||
    typeof rule.name !== 'string' ||
    typeof rule.enabled !== 'boolean' ||
    typeof rule.priority !== 'number' ||
    !Number.isFinite(rule.priority) ||
    conditions === null ||
    conditions.length !== inputConditionCount ||
    typeof rule.targetPathTemplate !== 'string'
  ) {
    return null;
  }

  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    priority: rule.priority,
    conditions,
    targetPathTemplate: rule.targetPathTemplate,
  };
}

function conditionValue(value: unknown): RuleCondition | null {
  const condition = asRecord(value);
  if (
    !condition ||
    !RULE_FIELDS.includes(condition.field as RuleField) ||
    !RULE_OPERATORS.includes(condition.operator as RuleOperator) ||
    !isConditionValue(condition.value)
  ) {
    return null;
  }

  return {
    field: condition.field as RuleField,
    operator: condition.operator as RuleOperator,
    value: condition.value,
  };
}

function isConditionValue(value: unknown): value is string | string[] {
  return typeof value === 'string' || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
}
