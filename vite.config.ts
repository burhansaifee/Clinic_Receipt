import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
        vite: {
          build: {
            commonjsOptions: {
              ignoreDynamicRequires: true
            },
            rollupOptions: {
              external: [
                'electron',
                'electron-updater',
                'node-machine-id',
                'electron-store',
                'better-sqlite3',
                '@whiskeysockets/baileys',
                'qrcode',
                'fs',
                'path',
                'crypto',
                'http',
                'https',
                'net',
                'tls',
                'os',
                'url',
                'module',
                'stream',
                'util',
                'buffer',
                'events',
                'zlib',
                'node:path',
                'node:fs',
                'node:module',
                'node:url',
                'node:crypto',
                'node:http',
                'node:os'
              ],
            },
          },
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        input: path.join(import.meta.dirname, 'electron/preload.ts'),
      },
    }),
  ],
})

