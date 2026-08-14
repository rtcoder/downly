import { type DragEvent, useEffect, useMemo, useState } from 'react';

import { getSettings, replaceRules, updateSettings } from '../../../application/settings-repository';
import type { DownloadRecord } from '../../../domain/downloads/types';
import { validateRule } from '../../../domain/organizer/evaluate-rule';
import { evaluateRules } from '../../../domain/organizer/evaluate-rules';
import { BUILT_IN_ORGANIZER_PRESETS } from '../../../domain/organizer/presets';
import type { ConflictAction, DownloadRule, RuleCondition, RuleField, RuleOperator } from '../../../domain/organizer/types';
import type { DownlySettings } from '../../../domain/settings/types';
import { EmptyState, ToastRegion } from '../../shared';

export interface OrganizerViewProps {
  previewDownload?: DownloadRecord | null;
}

type DraftRule = Omit<DownloadRule, 'conditions'> & { conditions: DraftCondition[] };
type DraftCondition = Omit<RuleCondition, 'value'> & { value: string };

const FIELDS: Array<{ id: RuleField; label: string }> = [
  { id: 'sourceDomain', label: 'Source domain' },
  { id: 'filename', label: 'Filename' },
  { id: 'extension', label: 'Extension' },
  { id: 'mime', label: 'MIME type' },
  { id: 'category', label: 'File category' },
];

const OPERATORS: Array<{ id: RuleOperator; label: string }> = [
  { id: 'equals', label: 'equals' },
  { id: 'endsWith', label: 'ends with' },
  { id: 'contains', label: 'contains' },
  { id: 'startsWith', label: 'starts with' },
  { id: 'regex', label: 'matches regex' },
  { id: 'oneOf', label: 'equals one of' },
];

const OPERATORS_BY_FIELD: Record<RuleField, RuleOperator[]> = {
  sourceDomain: ['equals', 'endsWith', 'contains'],
  filename: ['contains', 'startsWith', 'endsWith', 'regex'],
  extension: ['oneOf'],
  mime: ['equals', 'startsWith'],
  category: ['equals'],
};

const EMPTY_CONDITION: DraftCondition = { field: 'sourceDomain', operator: 'equals', value: '' };

const FALLBACK_PREVIEW_DOWNLOAD: DownloadRecord = {
  id: -1,
  filename: 'Invoice 2026.pdf',
  basename: 'Invoice 2026',
  extension: 'pdf',
  mime: 'application/pdf',
  category: 'document',
  state: 'complete',
  paused: false,
  canResume: false,
  exists: true,
  danger: 'safe',
  error: null,
  url: 'https://billing.example/invoice.pdf',
  finalUrl: null,
  referrer: null,
  sourceDomain: 'billing.example',
  bytesReceived: 2_048,
  totalBytes: 2_048,
  fileSize: 2_048,
  startTime: '2026-08-14T10:20:30.000Z',
  endTime: '2026-08-14T10:20:31.000Z',
  estimatedEndTime: null,
};

export function OrganizerView({ previewDownload = null }: OrganizerViewProps) {
  const [settings, setSettings] = useState<DownlySettings | null>(null);
  const [editing, setEditing] = useState<DraftRule | null>(null);
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const sampleDownload = previewDownload ?? FALLBACK_PREVIEW_DOWNLOAD;
  const orderedRules = useMemo(
    () => settings ? sortRulesByPriority(settings.rules) : [],
    [settings],
  );

  useEffect(() => {
    let alive = true;
    void getSettings()
      .then((loadedSettings) => {
        if (alive) setSettings(loadedSettings);
      })
      .catch((error: unknown) => {
        if (alive) setStorageError(messageFromError(error));
      });

    return () => {
      alive = false;
    };
  }, []);

  const preview = useMemo(() => {
    if (!settings) return null;
    const previewRules = editing ? rulesWithDraft(orderedRules, fromDraft(editing)) : orderedRules;
    return evaluateRules(sampleDownload, previewRules, settings.conflictAction);
  }, [editing, orderedRules, sampleDownload, settings]);

  if (!settings) {
    return <section aria-label="Smart Organizer settings">
      <h2>Smart Organizer</h2>
      <p>Loading organizer settings...</p>
      <OrganizerNotifications message={storageError} onDismiss={() => setStorageError(null)} />
    </section>;
  }

  const saveSettings = async (patch: Partial<Omit<DownlySettings, 'schemaVersion'>>) => {
    try {
      setStorageError(null);
      setSettings(await updateSettings(patch));
    } catch (error) {
      setStorageError(messageFromError(error));
    }
  };

  const saveRules = async (rules: DownloadRule[]): Promise<boolean> => {
    try {
      setStorageError(null);
      setSettings(await replaceRules(normalizePriorities(rules)));
      return true;
    } catch (error) {
      setStorageError(messageFromError(error));
      return false;
    }
  };

  const startNewRule = () => {
    setValidationError(null);
    setEditing({
      id: `custom-${Date.now()}`,
      name: '',
      enabled: true,
      priority: nextPriority(orderedRules),
      conditions: [{ ...EMPTY_CONDITION }],
      targetPathTemplate: '',
    });
  };

  const startEditRule = (rule: DownloadRule) => {
    setValidationError(null);
    setEditing(toDraft(rule));
  };

  const installPreset = async (preset: DownloadRule) => {
    const installedRule = { ...preset, enabled: true };
    const existingIndex = orderedRules.findIndex((rule) => rule.id === preset.id);
    const rules = existingIndex >= 0
      ? orderedRules.map((rule, index) => index === existingIndex ? installedRule : rule)
      : [...orderedRules, installedRule];

    await saveRules(rules);
  };

  const saveDraft = async () => {
    if (!editing) return;

    const candidate = fromDraft(editing);
    const error = validateRule(candidate);
    if (error) {
      setValidationError(error.message);
      return;
    }

    setValidationError(null);
    const unsupportedCondition = candidate.conditions.find((condition) => !operatorIsSupported(condition.field, condition.operator));
    if (unsupportedCondition) {
      setValidationError(`${labelForField(unsupportedCondition.field)} does not support ${labelForOperator(unsupportedCondition.operator)}.`);
      return;
    }

    const existingIndex = orderedRules.findIndex((rule) => rule.id === candidate.id);
    const rules = existingIndex >= 0
      ? orderedRules.map((rule, index) => index === existingIndex ? candidate : rule)
      : [...orderedRules, candidate];

    if (await saveRules(rules)) {
      setEditing(null);
    }
  };

  const toggleRule = (ruleId: string) => {
    void saveRules(orderedRules.map((rule) => rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule));
  };

  const deleteRule = (ruleId: string) => {
    void saveRules(orderedRules.filter((rule) => rule.id !== ruleId));
  };

  const moveRule = (ruleId: string, direction: -1 | 1) => {
    const index = orderedRules.findIndex((rule) => rule.id === ruleId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= orderedRules.length) return;

    void saveRules(moveRuleToIndex(orderedRules, index, target));
  };

  const dropRule = (event: DragEvent<HTMLElement>, targetRuleId: string) => {
    event.preventDefault();
    if (!draggedRuleId || draggedRuleId === targetRuleId) {
      setDraggedRuleId(null);
      return;
    }

    const source = orderedRules.findIndex((rule) => rule.id === draggedRuleId);
    const target = orderedRules.findIndex((rule) => rule.id === targetRuleId);
    if (source >= 0 && target >= 0) {
      void saveRules(moveRuleToIndex(orderedRules, source, target));
    }
    setDraggedRuleId(null);
  };

  const allowRuleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
  };

  const moveRuleToIndex = (rulesToMove: DownloadRule[], source: number, target: number) => {
    if (source === target) return rulesToMove;

    const rules = [...rulesToMove];
    const [moved] = rules.splice(source, 1);
    rules.splice(target, 0, moved);
    return rules;
  };

  return <section aria-label="Smart Organizer settings">
    <header>
      <h2>Smart Organizer</h2>
      <label>
        <input
          checked={settings.organizerEnabled}
          onChange={(event) => void saveSettings({ organizerEnabled: event.target.checked })}
          type="checkbox"
        />
        Enable Smart Organizer
      </label>
      <label>
        <span>Conflict action</span>
        <select
          aria-label="Conflict action"
          onChange={(event) => void saveSettings({ conflictAction: event.target.value as ConflictAction })}
          value={settings.conflictAction}
        >
          <option value="uniquify">uniquify</option>
          <option value="overwrite">overwrite</option>
          <option value="prompt">prompt</option>
        </select>
      </label>
    </header>

    <section aria-label="Organizer presets">
      <h3>Presets</h3>
      {BUILT_IN_ORGANIZER_PRESETS.map((preset) => (
        <button key={preset.id} onClick={() => void installPreset(preset)} type="button">
          {orderedRules.some((rule) => rule.id === preset.id) ? 'Enable' : 'Install'} {preset.name} preset
        </button>
      ))}
    </section>

    <section aria-label="Organizer rules">
      <header>
        <h3>Rules</h3>
        <button onClick={startNewRule} type="button">New custom rule</button>
      </header>
      {orderedRules.length === 0 ? (
        <EmptyState title="No organizer rules" description="Install a preset or create a custom rule to route future downloads." />
      ) : (
        orderedRules.map((rule, index) => (
          <article
            aria-grabbed={draggedRuleId === rule.id ? 'true' : undefined}
            aria-label={`${rule.name} rule`}
            draggable
            key={rule.id}
            onDragEnd={() => setDraggedRuleId(null)}
            onDragOver={allowRuleDrop}
            onDragStart={() => setDraggedRuleId(rule.id)}
            onDrop={(event) => dropRule(event, rule.id)}
          >
            <h4>{rule.name}</h4>
            <label>
              <input
                checked={rule.enabled}
                onChange={() => toggleRule(rule.id)}
                type="checkbox"
              />
              Enable {rule.name}
            </label>
            <p>{describeConditions(rule.conditions)}</p>
            <p>{rule.targetPathTemplate}</p>
            <button disabled={index === 0} onClick={() => moveRule(rule.id, -1)} type="button">
              Move {rule.name} up
            </button>
            <button disabled={index === orderedRules.length - 1} onClick={() => moveRule(rule.id, 1)} type="button">
              Move {rule.name} down
            </button>
            <button onClick={() => startEditRule(rule)} type="button">Edit {rule.name}</button>
            <button onClick={() => deleteRule(rule.id)} type="button">Delete {rule.name}</button>
          </article>
        ))
      )}
    </section>

    <PathPreview conflictAction={settings.conflictAction} preview={preview} sampleDownload={sampleDownload} />

    {editing ? (
      <RuleEditor
        draft={editing}
        onCancel={() => {
          setEditing(null);
          setValidationError(null);
        }}
        onChange={(draft) => {
          setEditing(draft);
          setValidationError(null);
        }}
        onSave={() => void saveDraft()}
        validationError={validationError}
      />
    ) : null}

    <OrganizerNotifications message={storageError} onDismiss={() => setStorageError(null)} />
  </section>;
}

interface RuleEditorProps {
  draft: DraftRule;
  onCancel: () => void;
  onChange: (draft: DraftRule) => void;
  onSave: () => void;
  validationError: string | null;
}

function RuleEditor({ draft, onCancel, onChange, onSave, validationError }: RuleEditorProps) {
  const updateCondition = (index: number, patch: Partial<DraftCondition>) => {
    onChange({
      ...draft,
      conditions: draft.conditions.map((condition, conditionIndex) => (
        conditionIndex === index ? normalizeDraftCondition({ ...condition, ...patch }) : condition
      )),
    });
  };

  return <form aria-label="Rule editor" onSubmit={(event) => {
    event.preventDefault();
    onSave();
  }}>
    <h3>{draft.name ? `Edit ${draft.name}` : 'New custom rule'}</h3>
    <label>
      <span>Rule name</span>
      <input
        aria-label="Rule name"
        onChange={(event) => onChange({ ...draft, name: event.target.value })}
        value={draft.name}
      />
    </label>
    <label>
      <input
        checked={draft.enabled}
        onChange={(event) => onChange({ ...draft, enabled: event.target.checked })}
        type="checkbox"
      />
      Rule enabled
    </label>

    <fieldset>
      <legend>AND conditions</legend>
      {draft.conditions.map((condition, index) => (
        <section aria-label={`Condition ${index + 1}`} key={index}>
          <label>
            <span>Field</span>
            <select
              aria-label={`Condition field ${index + 1}`}
              onChange={(event) => updateCondition(index, { field: event.target.value as RuleField })}
              value={condition.field}
            >
              {FIELDS.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
            </select>
          </label>
          <label>
            <span>Operator</span>
            <select
              aria-label={`Condition operator ${index + 1}`}
              onChange={(event) => updateCondition(index, { operator: event.target.value as RuleOperator })}
              value={condition.operator}
            >
              {operatorsForField(condition.field).map((operator) => <option key={operator.id} value={operator.id}>{operator.label}</option>)}
            </select>
          </label>
          <label>
            <span>Value</span>
            <input
              aria-label={`Condition value ${index + 1}`}
              onChange={(event) => updateCondition(index, { value: event.target.value })}
              value={condition.value}
            />
          </label>
          <button
            disabled={draft.conditions.length === 1}
            onClick={() => onChange({
              ...draft,
              conditions: draft.conditions.filter((_condition, conditionIndex) => conditionIndex !== index),
            })}
            type="button"
          >
            Remove condition {index + 1}
          </button>
        </section>
      ))}
      <button
        onClick={() => onChange({ ...draft, conditions: [...draft.conditions, { ...EMPTY_CONDITION }] })}
        type="button"
      >
        Add AND condition
      </button>
    </fieldset>

    <label>
      <span>Target path template</span>
      <input
        aria-label="Target path template"
        onChange={(event) => onChange({ ...draft, targetPathTemplate: event.target.value })}
        value={draft.targetPathTemplate}
      />
    </label>
    {validationError ? <p role="alert">{validationError}</p> : null}
    <button type="submit">Save rule</button>
    <button onClick={onCancel} type="button">Cancel</button>
  </form>;
}

function PathPreview({
  conflictAction,
  preview,
  sampleDownload,
}: {
  conflictAction: ConflictAction;
  preview: ReturnType<typeof evaluateRules>;
  sampleDownload: DownloadRecord;
}) {
  return <section aria-label="Target path preview">
    <h3>Target path preview</h3>
    <p>Sample: {sampleDownload.filename}</p>
    {preview ? (
      <>
        <p>{preview.filename}</p>
        <p>Matched rule: {preview.ruleId}</p>
      </>
    ) : (
      <p>No enabled rule matches this sample.</p>
    )}
    <p>Conflict action: {conflictAction}</p>
  </section>;
}

function OrganizerNotifications({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  return <ToastRegion
    messages={message ? [{ id: 'organizer-storage-error', tone: 'error', message }] : []}
    onDismiss={onDismiss}
  />;
}

function toDraft(rule: DownloadRule): DraftRule {
  return {
    ...rule,
    conditions: rule.conditions.map((condition) => ({
      ...condition,
      value: Array.isArray(condition.value) ? condition.value.join(',') : condition.value,
    })),
  };
}

function fromDraft(draft: DraftRule): DownloadRule {
  return {
    ...draft,
    name: draft.name.trim() || 'Untitled rule',
    targetPathTemplate: draft.targetPathTemplate.trim(),
    conditions: draft.conditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: condition.operator === 'oneOf'
        ? condition.value.split(',').map((value) => value.trim()).filter(Boolean)
        : condition.value.trim(),
    })),
  };
}

function normalizePriorities(rules: DownloadRule[]): DownloadRule[] {
  return rules.map((rule, index) => ({ ...rule, priority: (index + 1) * 10 }));
}

function sortRulesByPriority(rules: DownloadRule[]): DownloadRule[] {
  return rules
    .map((rule, index) => ({ rule, index }))
    .sort((left, right) => left.rule.priority - right.rule.priority || left.index - right.index)
    .map(({ rule }) => rule);
}

function nextPriority(rules: DownloadRule[]): number {
  return rules.length === 0 ? 10 : Math.max(...rules.map((rule) => rule.priority)) + 10;
}

function rulesWithDraft(rules: DownloadRule[], draft: DownloadRule): DownloadRule[] {
  const existingIndex = rules.findIndex((rule) => rule.id === draft.id);
  if (existingIndex === -1) return [...rules, draft];

  return rules.map((rule, index) => index === existingIndex ? draft : rule);
}

function describeConditions(conditions: RuleCondition[]): string {
  return conditions
    .map((condition) => `${condition.field} ${condition.operator} ${Array.isArray(condition.value) ? condition.value.join(', ') : condition.value}`)
    .join(' AND ');
}

function operatorsForField(field: RuleField): Array<{ id: RuleOperator; label: string }> {
  const supported = OPERATORS_BY_FIELD[field];
  return OPERATORS.filter((operator) => supported.includes(operator.id));
}

function operatorIsSupported(field: RuleField, operator: RuleOperator): boolean {
  return OPERATORS_BY_FIELD[field].includes(operator);
}

function normalizeDraftCondition(condition: DraftCondition): DraftCondition {
  return operatorIsSupported(condition.field, condition.operator)
    ? condition
    : { ...condition, operator: OPERATORS_BY_FIELD[condition.field][0] };
}

function labelForField(field: RuleField): string {
  return FIELDS.find((item) => item.id === field)?.label ?? field;
}

function labelForOperator(operator: RuleOperator): string {
  return OPERATORS.find((item) => item.id === operator)?.label ?? operator;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Organizer settings could not be saved.';
}
