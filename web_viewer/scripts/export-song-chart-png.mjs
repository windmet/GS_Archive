// Offline fallback for the verified, self-contained SVG downloaded from the archive.
// Requires the existing dev dependency sharp (npm ci). No full-height raster allocation.
import { readFile, rename, rm } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { once } from 'node:events'
import { createDeflate } from 'node:zlib'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { planSongChartPng, pngHeader, pngChunk } from '../src/presentation/SongChartPngExport.js'
sharp.cache(false)
sharp.concurrency(1)
const [input, output, factorText = '2'] = process.argv.slice(2)
if (!input || !output || resolve(input) === resolve(output)) throw new Error('Usage: npm run export:song-chart-png -- input.svg output.png [2] (input and output must differ)')
const svg = await readFile(input, 'utf8')
if (/<!DOCTYPE|<!ENTITY|<script|<foreignObject|<style/i.test(svg)
  || [...svg.matchAll(/(?:href|xlink:href)\s*=\s*["']([^"']*)/gi)].some(m => !/^(#|data:image\/png;base64,)/.test(m[1]))
  || [...svg.matchAll(/url\(([^)]*)\)/gi)].some(m => !/^#[\w-]+$/.test(m[1]))) throw new Error('Only self-contained archive SVGs with embedded PNG assets are accepted')
const root = svg.match(/<svg\b[^>]*>/)?.[0]
const box = root?.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number)
if (!box || box[0] !== 0 || box[1] !== 0) throw new Error('Invalid archive SVG viewBox')
const plan = planSongChartPng(box[2], box[3], Number(factorText))
const temporary = `${resolve(output)}.${randomUUID()}.tmp`
const file = createWriteStream(temporary, { flags: 'wx' }), deflate = createDeflate()
let fileError
file.on('error', e => { fileError = e; deflate.destroy(e) })
async function write(bytes) { if (fileError) throw fileError; if (!file.write(bytes)) await once(file, 'drain') }
let collector
try {
  for (const bytes of pngHeader(plan.width, plan.height)) await write(bytes)
  collector = (async () => { for await (const data of deflate) await write(pngChunk('IDAT', data)) })()
  // Attach an immediate rejection handler while the producer awaits rasterization.
  collector.catch(() => {})
  for (let start = 0; start < plan.height; start += plan.tileHeight) {
    if (fileError || deflate.destroyed) throw fileError || new Error('PNG compression failed')
    const rows = Math.min(plan.tileHeight, plan.height - start)
    const top = Math.max(0, start - plan.overlap), bottom = Math.min(plan.height, start + rows + plan.overlap)
    const tileRoot = root.replace(/\s(?:width|height|viewBox|preserveAspectRatio)="[^"]*"/g, '').replace(/>$/, ` width="${plan.width}" height="${bottom-top}" viewBox="0 ${top/plan.factor} ${box[2]} ${(bottom-top)/plan.factor}" preserveAspectRatio="none">`)
    const { data, info } = await sharp(Buffer.from(svg.replace(root, tileRoot)), { limitInputPixels: 2 * 1024 * 1024 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    if (info.width !== plan.width || info.height !== bottom-top || info.channels !== 4) throw new Error('Unexpected raster dimensions')
    const stride = plan.width * 4, scanlines = Buffer.alloc((stride + 1) * rows)
    for (let row = 0; row < rows; row++) data.copy(scanlines, row * (stride + 1) + 1, (row + start - top) * stride, (row + start - top + 1) * stride)
    if (!deflate.write(scanlines)) await once(deflate, 'drain')
  }
  deflate.end(); await collector
  await write(pngChunk('IEND')); file.end(); await once(file, 'finish')
  await rename(temporary, output)
  console.log(`Saved ${output}: ${plan.width} × ${plan.height}, complete image, ${plan.tileHeight}-row tiles`)
} catch (e) {
  deflate.destroy(); file.destroy(); await collector?.catch(() => {})
  await rm(temporary, { force: true }); throw e
}
