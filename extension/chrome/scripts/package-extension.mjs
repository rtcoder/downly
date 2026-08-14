import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const distDirectory = resolve(root, 'dist');
const manifestPath = resolve(distDirectory, 'manifest.json');

if (!existsSync(manifestPath)) {
  throw new Error('Build the extension before packaging it.');
}

const { version } = JSON.parse(readFileSync(manifestPath, 'utf8'));
const outputDirectory = resolve(root, 'artifacts');
const archivePath = resolve(outputDirectory, `downly-chrome-${version}.zip`);

mkdirSync(outputDirectory, { recursive: true });
rmSync(archivePath, { force: true });
execFileSync('zip', ['-q', '-r', archivePath, '.'], { cwd: distDirectory });

const zipEntries = execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

if (!zipEntries.includes('manifest.json')) {
  throw new Error('Packaged extension zip must contain manifest.json at the archive root.');
}

if (zipEntries.some((entry) => entry.startsWith('dist/'))) {
  throw new Error('Packaged extension zip must not include an extra dist/ directory level.');
}
