import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const manifestPath = resolve(root, 'public/manifest.json');
const messagesPath = resolve(root, 'public/_locales/en/messages.json');

describe('Downly bootstrap', () => {
  it('defines a localized, privacy-preserving Manifest V3 extension', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      manifest_version: number;
      name: string;
      description: string;
      version: string;
      minimum_chrome_version: string;
      default_locale: string;
      permissions: string[];
      host_permissions?: string[];
      content_scripts?: unknown[];
      background: { service_worker: string; type: string };
      side_panel: { default_path: string };
      options_ui: { page: string };
      icons: Record<string, string>;
    };
    const messages = JSON.parse(readFileSync(messagesPath, 'utf8')) as {
      extensionName: { message: string };
      extensionDescription: { message: string };
    };

    expect(manifest).toMatchObject({
      manifest_version: 3,
      name: '__MSG_extensionName__',
      description: '__MSG_extensionDescription__',
      version: '0.1.0',
      minimum_chrome_version: '123',
      default_locale: 'en',
      background: { service_worker: 'service-worker.js', type: 'module' },
      side_panel: { default_path: 'sidepanel.html' },
      options_ui: { page: 'manager.html?view=settings' },
    });
    expect(manifest.permissions).toEqual([
      'downloads',
      'downloads.open',
      'downloads.ui',
      'storage',
      'sidePanel',
    ]);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(messages.extensionName.message).toBe('Downly');
    expect(messages.extensionDescription.message).toBeTruthy();
  });

  it('builds every manifest-referenced extension file', () => {
    execFileSync(
      process.execPath,
      [resolve(root, 'node_modules/vite/bin/vite.js'), 'build'],
      { cwd: root, stdio: 'pipe' },
    );

    const manifest = JSON.parse(readFileSync(resolve(root, 'dist/manifest.json'), 'utf8')) as {
      background: { service_worker: string };
      side_panel: { default_path: string };
      options_ui: { page: string };
      icons: Record<string, string>;
    };
    const referencedFiles = [
      manifest.background.service_worker,
      manifest.side_panel.default_path,
      manifest.options_ui.page.split('?')[0],
      ...Object.values(manifest.icons),
      '_locales/en/messages.json',
    ];

    expect(referencedFiles).toEqual(expect.arrayContaining([
      'service-worker.js',
      'sidepanel.html',
      'manager.html',
    ]));
    expect(referencedFiles.every((file) => existsSync(resolve(root, 'dist', file)))).toBe(true);
  });
});
