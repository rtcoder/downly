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
