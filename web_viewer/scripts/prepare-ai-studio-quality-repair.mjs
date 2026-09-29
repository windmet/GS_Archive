import fs from 'node:fs/promises'
import path from 'node:path'
import { checkStudioBatch } from './lib/ai-studio-check.mjs'
import { makeQualityRequest } from './lib/ai-studio-quality.mjs'

if (process.argv.length !== 4) throw Error('Usage: node scripts/prepare-ai-studio-quality-repair.mjs BATCH_FOLDER T000001,T000002')
const { folder, batch, report } = await checkStudioBatch(process.argv[2])
if (report.structure !== 'PASS') throw Error('Parent output has structural errors')
const ids = process.argv[3].split(',').map(value => value.trim())
const parentOutput = await fs.readFile(path.join(folder, 'output.md'), 'utf8')
const { request, map } = makeQualityRequest(batch, parentOutput, ids)
await fs.writeFile(path.join(folder, 'quality-repair.md'), request, { flag: 'wx' })
await fs.writeFile(path.join(folder, 'quality-repair-map.json'), JSON.stringify(map, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ folder, targets: map.targets.map(item => item.rid),
  parent_output_sha256: map.parent_output_sha256, request_sha256: map.request_sha256 }, null, 2))
