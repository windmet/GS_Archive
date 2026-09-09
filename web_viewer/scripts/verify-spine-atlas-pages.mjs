import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { readSpineAtlasPages, decodeSpineAtlasText, resolveSpineAtlasDependencies } from '../shared/story/SpineAtlasPages.js'
import { loadAndCreateSpine } from '../src/core/spineSpawnPipeline.js'
import { TextureAtlas as InstalledTextureAtlas } from '@pixi-spine/base'

const atlas = 'folder-a/page.png\nsize: 32,32\nfilter: Linear,Linear\nregion-a\n  xy: 0,0\n  size: 4,4\n\nfolder-b/page.png\nsize: 32,32\nfilter: Linear,Linear\nregion-b\n  xy: 0,0\n  size: 4,4\n'
assert.deepEqual(readSpineAtlasPages(atlas), ['folder-a/page.png', 'folder-b/page.png'])
assert.deepEqual(readSpineAtlasPages(atlas.replaceAll('\n', '\r\n')), readSpineAtlasPages(atlas))
const parserCalls = []
await new Promise(resolve => new InstalledTextureAtlas('a.png\nsize: 32,32\nfilter: Linear,Linear\n\nb.png\nsize: 32,32\nfilter: Linear,Linear\n',
  (name, complete) => { parserCalls.push(name); complete({ valid: true, realWidth: 32, realHeight: 32 }) }, resolve))
assert.deepEqual(parserCalls, ['a.png', 'b.png'], 'page grammar agrees with the installed runtime parser')
for (const bad of ['', '../page.png\nsize: 1,1', '/page.png', 'page.png\n\npage.png']) assert.throws(() => readSpineAtlasPages(bad))
let constructed = 0, binaryReads = 0
const loaded = [], resolved = [], bound = []
const fakeTexture = file => ({ baseTexture: { file } })
const options = {
  modelId: 'test', atlasUrl: 'atlas', skelUrl: 'skel', decodeAtlasText: decodeSpineAtlasText,
  fetchImpl: async url => new Response(url === 'atlas' ? atlas : 'skeleton'),
  resolveTextureUrl: async (model, file, policy) => { resolved.push([file, policy.allowFallback]); return file },
  loadTextureFromUrl: async file => { loaded.push(file); return fakeTexture(file) },
  decodeSkelBuffer: bytes => bytes,
  TextureAtlas: class {
    constructor(text, loader, complete) {
      const pages = []
      for (const file of ['folder-a/page.png', 'folder-b/page.png']) {
        loader(file, texture => { assert.equal(texture?.file, file); bound.push(file); pages.push({ name: file }) })
      }
      complete({ pages })
    }
  },
  AtlasAttachmentLoader: class {},
  SkeletonBinary: class { readSkeletonData() { binaryReads++; return { animations: [], skins: [] } } },
  Spine: class { constructor() { constructed++ } },
}
const result = await loadAndCreateSpine(options)
assert.deepEqual(result.textureFiles, ['folder-a/page.png', 'folder-b/page.png'])
assert.deepEqual(loaded, bound)
assert.ok(resolved.every(([, fallback]) => fallback === false), 'multi-page must not alias pages to comu.png')
assert.equal(constructed, 1)
await assert.rejects(loadAndCreateSpine({ ...options, loadTextureFromUrl: async file => {
  if (file.startsWith('folder-b')) throw Error('controlled page 404')
  return fakeTexture(file)
} }), /controlled page 404/)
assert.equal(binaryReads, 1, 'a missing page must fail before skeleton parsing/construction')
let release
const delayed = loadAndCreateSpine({ ...options, loadTextureFromUrl: file => file.startsWith('folder-b')
  ? new Promise(resolve => { release = () => resolve(fakeTexture(file)) }) : Promise.resolve(fakeTexture(file)) })
while (!release) await new Promise(resolve => setImmediate(resolve))
assert.equal(constructed, 1, 'do not construct while a page is pending')
release(); await delayed
assert.equal(constructed, 2)
await loadAndCreateSpine({ ...options,
  fetchImpl: async url => new Response(url === 'atlas' ? 'original.png\nsize: 32,32\n' : 'skeleton'),
  resolveTextureUrl: async (model, file, policy) => { assert.equal(policy.allowFallback, true); return file },
  TextureAtlas: class { constructor(text, loader, complete) {
    loader('original.png', texture => { assert.equal(texture.file, 'original.png'); complete({ pages: [{}] }) })
  } },
})
const plan = { assets: [{ key: 'spine-bundle:test', dependencyState: 'pending', dependencies: ['spine-atlas:test'], uses: [{ stepId: 7 }] }], unresolved: [] }
const hash = `sha256:${createHash('sha256').update(atlas).digest('hex')}`
const expanded = resolveSpineAtlasDependencies(plan, { modelId: 'test', atlasText: atlas, atlasSha256: hash, modelKind: 'spine' })
assert.equal(plan.assets.length, 1, 'expansion does not mutate input')
assert.equal(expanded.assets.length, 3)
assert.equal(expanded.dependenciesComplete, true)
assert.equal(expanded.assets[1].atlasSource.sha256, hash)
assert.throws(() => resolveSpineAtlasDependencies(plan, { modelId: 'test', atlasText: atlas, atlasSha256: hash, modelKind: 'silhouette' }))

if (process.argv.includes('--local-assets')) {
  const root = new URL('../public/assets/spines/', import.meta.url)
  let count = 0, multi = 0
  for (const directory of await fs.readdir(root, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue
    let bytes
    try { bytes = await fs.readFile(new URL(`${directory.name}/comu.atlas`, root)) }
    catch (error) { if (error.code === 'ENOENT') continue; throw error }
    const pages = readSpineAtlasPages(decodeSpineAtlasText(bytes))
    assert.ok(pages.length > 0)
    count++; if (pages.length > 1) multi++
  }
  assert.ok(count > 0)
  console.log(`Local atlas parsing: ${count} models, ${multi} multi-page`)
}
console.log('Atlas pages verified: relative paths, dependency expansion, real load pipeline, delayed page and missing page rejection')
