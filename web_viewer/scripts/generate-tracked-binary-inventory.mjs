import { mkdir, writeFile } from 'node:fs/promises'
import {
  generateTrackedBinaryInventory,
  inventoryPath,
  stableJson,
} from './lib/tracked-binary-inventory.mjs'

const inventory = await generateTrackedBinaryInventory()
await mkdir(new URL('../policies/', import.meta.url), { recursive: true })
await writeFile(inventoryPath, stableJson(inventory), 'utf8')

console.log(
  `Tracked binary inventory written: ${inventory.summary.files} files / ` +
  `${inventory.summary.bytes} bytes`,
)
