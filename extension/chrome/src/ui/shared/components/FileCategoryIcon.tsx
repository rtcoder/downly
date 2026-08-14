import type { FileCategory } from '../../../domain/downloads/types';
import { t } from '../i18n';

const CATEGORY_LABELS: Record<FileCategory, string> = {
  archive: t('shared.fileCategory.archive'),
  audio: t('shared.fileCategory.audio'),
  code: t('shared.fileCategory.code'),
  document: t('shared.fileCategory.document'),
  image: t('shared.fileCategory.image'),
  installer: t('shared.fileCategory.installer'),
  other: t('shared.fileCategory.other'),
  video: t('shared.fileCategory.video'),
};

const CATEGORY_SYMBOLS: Record<FileCategory, string> = {
  archive: 'ZIP',
  audio: 'AUD',
  code: 'DEV',
  document: 'DOC',
  image: 'IMG',
  installer: 'APP',
  other: 'FILE',
  video: 'VID',
};

export interface FileCategoryIconProps {
  category: FileCategory;
}

export function FileCategoryIcon({ category }: FileCategoryIconProps) {
  return <span aria-label={CATEGORY_LABELS[category]} role="img">{CATEGORY_SYMBOLS[category]}</span>;
}
