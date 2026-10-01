import assert from 'node:assert/strict'
import { inflateSync } from 'node:zlib'
import { assertBrowserSongChartPng, planSongChartPng, pngHeader, pngChunk, PNG_TILE_PIXELS } from '../src/presentation/SongChartPngExport.js'
// Exercise the actual browser stream format against an independent zlib decoder.
const width = 3, height = 40001, parts = pngHeader(width, height)
const compression = new CompressionStream('deflate'), writer = compression.writable.getWriter()
const collector = (async () => { for await (const data of compression.readable) parts.push(pngChunk('IDAT', data)) })()
for (let start = 0; start < height; start += 1024) {
  const rows = Math.min(1024, height-start), data = new Uint8Array(rows * (width*4+1))
  for (let row = 0; row < rows; row++) for (let x = 0; x < width; x++) data.set([(start+row)%256, x, 17, 255], row*(width*4+1)+1+x*4)
  await writer.write(data)
}
await writer.close(); await collector; parts.push(pngChunk('IEND'))
assert.equal(Buffer.from(pngChunk('IEND')).toString('hex'), '0000000049454e44ae426082')
const png = Buffer.concat(parts.map(p => Buffer.from(p))), idat = []
for (let pos = 8; pos < png.length;) {
  const size = png.readUInt32BE(pos), type = png.toString('ascii',pos+4,pos+8)
  if (type === 'IDAT') idat.push(png.subarray(pos+8,pos+8+size))
  if (type === 'IHDR') { assert.equal(png.readUInt32BE(pos+8), width); assert.equal(png.readUInt32BE(pos+12), height) }
  pos += size+12
}
const raw = inflateSync(Buffer.concat(idat)); assert.equal(raw.length, height*(width*4+1))
for (const row of [0,1023,1024,2047,2048,height-1]) assert.deepEqual([...raw.subarray(row*13+1,row*13+5)], [row%256,0,17,255])
for (const height of [100,32768,100001,1000000]) {
  const plan = planSongChartPng(410,height)
  assert.equal(plan.height,height*2); assert.equal(plan.width,820)
  assert.ok(plan.width*(plan.tileHeight+2*plan.overlap) <= PNG_TILE_PIXELS)
}
assert.throws(() => planSongChartPng(410,Number.MAX_SAFE_INTEGER))
assert.throws(() => planSongChartPng(5000,100))
assert.throws(() => assertBrowserSongChartPng(410,424896), /安全像素预算/)
assert.equal(planSongChartPng(410,424896).height,849792) // Offline keeps full resolution
assert.equal(assertBrowserSongChartPng(410,30928).width,820)
console.log('PNG stream verified: full 40,001 rows, exact boundary pixels, fixed resolution and bounded tile budget')

if (process.argv[2]) {
  const { verifySongChartPngRows } = await import('./lib/song-chart-png-qa.mjs')
  console.log(await verifySongChartPngRows(process.argv[2], Number(process.argv[3]), Number(process.argv[4])))
}
