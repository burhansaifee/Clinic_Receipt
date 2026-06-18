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
                'node:path',
                'node:fs',
                'node:module',
                'node:url',
                'node:crypto'
              ],
            },
          },
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        input: path.join(__dirname, 'electron/preload.ts'),
      },
    }),
  ],
})

