import type { FileCategory } from '../../../domain/downloads/types';

const CATEGORY_LABELS: Record<FileCategory, string> = {
  archive: 'Archive file',
  audio: 'Audio file',
  code: 'Code file',
  document: 'Document file',
  image: 'Image file',
  installer: 'Installer file',
  other: 'File',
  video: 'Video file',
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
