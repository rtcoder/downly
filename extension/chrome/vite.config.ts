import { renameSync, rmdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function flattenExtensionHtml(): Plugin {
  const destinations: Record<string, string> = {
    'src/ui/sidepanel/index.html': 'sidepanel.html',
    'src/ui/manager/index.html': 'manager.html',
  };

  return {
    name: 'flatten-extension-html',
    closeBundle() {
      for (const [source, destination] of Object.entries(destinations)) {
        renameSync(resolve(__dirname, 'dist', source), resolve(__dirname, 'dist', destination));
      }

      rmdirSync(resolve(__dirname, 'dist', 'src/ui/sidepanel'));
      rmdirSync(resolve(__dirname, 'dist', 'src/ui/manager'));
      rmdirSync(resolve(__dirname, 'dist', 'src/ui'));
      rmdirSync(resolve(__dirname, 'dist', 'src'));
    },
  };
}

export default defineConfig({
  plugins: [react(), flattenExtensionHtml()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/ui/sidepanel/index.html'),
        manager: resolve(__dirname, 'src/ui/manager/index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'service-worker'
            ? 'service-worker.js'
            : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
