/// <reference types="vitest/config" />
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

const isVitest = Boolean(process.env.VITEST)
const isProductionBuild =
  process.argv.includes('build') && !process.argv.includes('preview')

// Museum production builds must not ingest repo .env* into Vite or Worker preview vars.
if (isProductionBuild) {
  process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false'
}

export default defineConfig({
  // Do not load repo .env / .env.local into the Vite graph or client defines.
  envDir: false,
  server: {
    port: 3000,
  },
  plugins: [
    !isVitest && cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart(),
    viteReact(),
  ].filter(Boolean),
  test: {
    setupFiles: ['./vitest.setup.ts'],
  },
})
