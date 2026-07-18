import { defineConfig, globalIgnores } from 'eslint/config'
import { tanstackConfig } from '@tanstack/eslint-config'

export default defineConfig([
  ...tanstackConfig,
  globalIgnores([
    'public/museum/**',
    'dist/**',
    '.output/**',
    '.wrangler/**',
    'scripts/museum/**',
  ]),
])
