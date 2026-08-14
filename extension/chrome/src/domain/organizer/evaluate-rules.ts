import type { DownloadRecord } from '../downloads/types';
import { evaluateRule } from './evaluate-rule';
import { renderPathTemplate } from './render-path-template';
import { sanitizeDownloadPath } from './sanitize-download-path';
import type { ConflictAction, DownloadRule, FilenameSuggestion } from './types';

export function evaluateRules(
  record: DownloadRecord,
  rules: readonly DownloadRule[],
  conflictAction: ConflictAction = 'uniquify',
): FilenameSuggestion | null {
  const sortedRules = rules
    .map((rule, index) => ({ rule, index }))
    .sort((left, right) => left.rule.priority - right.rule.priority || left.index - right.index);

  for (const { rule } of sortedRules) {
    if (!evaluateRule(record, rule)) continue;

    const renderedPath = renderPathTemplate(rule.targetPathTemplate, record);
    const filename = sanitizeDownloadPath(withFilename(renderedPath, record));
    if (!filename) continue;

    return { filename, conflictAction, ruleId: rule.id };
  }

  return null;
}

function withFilename(path: string, record: DownloadRecord): string {
  const leafFilename = record.filename.split(/[\\/]/).at(-1) ?? '';
  const templateHasFilename = path.includes(leafFilename);
  const normalizedPath = path.replace(/\\/g, '/');
  const lastSegment = normalizedPath.split('/').filter(Boolean).at(-1) ?? '';
  const sourceExtension = leafFilename.lastIndexOf('.') > 0 ? leafFilename.slice(leafFilename.lastIndexOf('.')) : '';

  if (!templateHasFilename && (!lastSegment || normalizedPath.endsWith('/'))) {
    return `${path}${normalizedPath.endsWith('/') || !path ? '' : '/'}${leafFilename}`;
  }

  if (!templateHasFilename && sourceExtension && !lastSegment.endsWith(sourceExtension)) {
    return `${path}${sourceExtension}`;
  }

  return path;
}
