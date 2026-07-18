#!/usr/bin/env node
import { resolve } from 'node:path'
import { generateMuseumFromSnapshot } from './generateMuseum.ts'

function usage(): never {
  console.error(
    'Usage: node --experimental-strip-types scripts/museum/cli.ts <snapshot.zip> <outputDir>',
  )
  process.exit(1)
}

const snapshotPath = process.argv[2]
const outputDir = process.argv[3]
if (!snapshotPath || !outputDir) usage()

const result = await generateMuseumFromSnapshot({
  snapshotPath: resolve(snapshotPath),
  outputDir: resolve(outputDir),
})

console.log(
  JSON.stringify(
    {
      completedGameCount: result.completedGameCount,
      abandonedExcludedCount: result.abandonedExcludedCount,
      gameFileCount: result.gameIds.length,
      outputFiles: result.outputFiles.length,
    },
    null,
    2,
  ),
)
