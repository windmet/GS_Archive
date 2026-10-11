// Independent zlib decode of every scanline, bounded by one row and one output chunk.
import { readFile } from 'node:fs/promises'
import { createInflate } from 'node:zlib'
import { once } from 'node:events'
import assert from 'node:assert/strict'
export async function verifySongChartPngRows(path, width, height) {
  const data = await readFile(path), chunks = []
  assert.deepEqual([...data.subarray(0,8)], [137,80,78,71,13,10,26,10])
  assert.equal(data.readUInt32BE(16), width); assert.equal(data.readUInt32BE(20), height)
  let end = false
  for (let p = 8; p < data.length;) {
    const n = data.readUInt32BE(p), type = data.toString('ascii',p+4,p+8)
    assert.ok(p+n+12 <= data.length)
    if (type === 'IDAT') chunks.push(data.subarray(p+8,p+8+n))
    if (type === 'IEND') { assert.equal(p+n+12,data.length); end = true }
    p += n+12
  }
  assert.ok(end)
  const inflater = createInflate(), stride = width*4+1
  let rows = 0, leftover = Buffer.alloc(0), firstPixel, lastPixel
  const read = (async () => {
    for await (const buf of inflater) {
      const joined = Buffer.concat([leftover,buf]); let p = 0
      for (; p+stride <= joined.length; p+=stride) {
        assert.equal(joined[p],0) // Our encoders deliberately use filter 0.
        if (!rows) firstPixel = [...joined.subarray(p+1,p+5)]
        lastPixel = [...joined.subarray(p+1,p+5)]; rows++
      }
      leftover = Buffer.from(joined.subarray(p))
    }
    assert.equal(leftover.length,0)
  })()
  read.catch(() => {})
  for (const c of chunks) if (!inflater.write(c)) await once(inflater,'drain')
  inflater.end(); await read; assert.equal(rows,height)
  return { width, height, decodedRows: rows, firstPixel, lastPixel }
}
