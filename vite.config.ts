import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

const isVitest = Boolean(process.env.VITEST)

export default defineConfig({
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
})
