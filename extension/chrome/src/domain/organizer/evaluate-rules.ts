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
  const normalizedPath = path.replace(/\\/g, '/');
  const templateHasFilename = normalizedPath.includes(leafFilename);
  const lastSegment = normalizedPath.split('/').filter(Boolean).at(-1) ?? '';
  const sourceExtension = leafFilename.lastIndexOf('.') > 0 ? leafFilename.slice(leafFilename.lastIndexOf('.')) : '';

  if (!templateHasFilename && (!lastSegment || normalizedPath.endsWith('/'))) {
    return `${normalizedPath}${normalizedPath.endsWith('/') || !normalizedPath ? '' : '/'}${leafFilename}`;
  }

  if (!templateHasFilename && sourceExtension) {
    const extensionStart = extensionStartFor(lastSegment);
    if (extensionStart === -1) return `${normalizedPath}${sourceExtension}`;

    const templateExtension = lastSegment.slice(extensionStart);
    if (templateExtension.toLowerCase() !== sourceExtension.toLowerCase()) {
      return `${normalizedPath.slice(0, -lastSegment.length)}${lastSegment.slice(0, extensionStart)}${sourceExtension}`;
    }
  }

  return normalizedPath;
}

function extensionStartFor(filename: string): number {
  const extensionStart = filename.lastIndexOf('.');
  return extensionStart > 0 && extensionStart < filename.length - 1 ? extensionStart : -1;
}
