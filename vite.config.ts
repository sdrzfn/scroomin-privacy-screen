import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };
import { existsSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';

// https://vite.dev/config/
function copyPublicFolder() {
  return {
    name: 'copy-public',
    writeBundle() {
      const src = resolve(__dirname, 'public');
      const dest = resolve(__dirname, 'dist');
      if (existsSync(src)) {
        cpSync(src, dest, { recursive: true });
      }
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    copyPublicFolder(),
  ],
  build: {
    rollupOptions: {
      input: {
        offscreen: resolve(__dirname, 'src/offscreen/offscreen.html'),
        permission: resolve(__dirname, 'src/permission/permission.html'),
      },
    },
  },
})