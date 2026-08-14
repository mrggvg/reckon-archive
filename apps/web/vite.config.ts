import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // shared and web each resolve zod locally; ship one copy.
    dedupe: ['zod'],
    alias: {
      // Until the repo becomes an npm workspace, the alias is what makes
      // @reckon/shared resolve at build time as well as in the type checker.
      '@reckon/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
})
