const CONTROL_CHARACTERS = new RegExp(String.raw`[\u0000-\u001f\u007f]`, 'g');
const PROBLEMATIC_FILENAME_CHARACTERS = /[<>:"|?*\\]/g;

export function sanitizeDownloadPath(path: string): string | null {
  const withoutControls = path.replace(CONTROL_CHARACTERS, '');
  const normalized = withoutControls.replace(/\\/g, '/');

  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return null;

  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) return null;

  const safePath = segments
    .map((segment) => segment.replace(PROBLEMATIC_FILENAME_CHARACTERS, '_'))
    .join('/');

  return safePath || null;
}
