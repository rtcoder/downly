import type { FileCategory } from './types';

const extensionCategories: Record<string, FileCategory> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', ico: 'image', tif: 'image', tiff: 'image',
  mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video', mpeg: 'video', mpg: 'video', m4v: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio', aac: 'audio', wma: 'audio',
  pdf: 'document', doc: 'document', docx: 'document', xls: 'document', xlsx: 'document', ppt: 'document', pptx: 'document', odt: 'document', ods: 'document', odp: 'document', rtf: 'document', txt: 'document', csv: 'document', epub: 'document',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive', bz2: 'archive', xz: 'archive', zst: 'archive',
  exe: 'installer', msi: 'installer', msix: 'installer', dmg: 'installer', pkg: 'installer', deb: 'installer', rpm: 'installer', apk: 'installer', appimage: 'installer',
  js: 'code', mjs: 'code', cjs: 'code', ts: 'code', tsx: 'code', jsx: 'code', json: 'code', html: 'code', htm: 'code', css: 'code', scss: 'code', sass: 'code', less: 'code', xml: 'code', yaml: 'code', yml: 'code', py: 'code', rb: 'code', php: 'code', java: 'code', c: 'code', h: 'code', cpp: 'code', hpp: 'code', cs: 'code', go: 'code', rs: 'code', sh: 'code', sql: 'code', md: 'code',
};

const mimeCategories: Record<string, FileCategory> = {
  'application/pdf': 'document',
  'application/zip': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/gzip': 'archive',
  'application/x-tar': 'archive',
  'application/vnd.android.package-archive': 'installer',
  'application/vnd.microsoft.portable-executable': 'installer',
  'application/x-msdownload': 'installer',
  'application/javascript': 'code',
  'application/json': 'code',
  'application/xml': 'code',
  'text/css': 'code',
  'text/html': 'code',
  'text/javascript': 'code',
  'text/xml': 'code',
  'text/csv': 'document',
  'text/plain': 'document',
};

function categoryFromMime(mime: string | null): FileCategory | null {
  if (!mime) return null;

  const normalizedMime = mime.split(';', 1)[0].trim().toLowerCase();
  if (normalizedMime.startsWith('image/')) return 'image';
  if (normalizedMime.startsWith('video/')) return 'video';
  if (normalizedMime.startsWith('audio/')) return 'audio';

  return mimeCategories[normalizedMime] ?? null;
}

export function categorizeFile(mime: string | null, extension: string | null): FileCategory {
  return categoryFromMime(mime) ?? (extension ? extensionCategories[extension] : undefined) ?? 'other';
}
