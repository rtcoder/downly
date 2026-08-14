if (import.meta.env.DEV) {
  console.info('Downly service worker started');
}

import { registerFilenameListener } from './filename-listener';

registerFilenameListener((globalThis as typeof globalThis & { chrome: Parameters<typeof registerFilenameListener>[0] }).chrome);
