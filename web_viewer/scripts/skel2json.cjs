#!/usr/bin/env node
/**
 * skel2json - Strip Unity header + convert Spine binary (.skel) to Spine JSON
 *
 * Usage: node scripts/skel2json.cjs <modelId>
 *   e.g. node scripts/skel2json.cjs 040ren_002_00
 *
 * Output: public/assets/spines/<modelId>/comu.json
 *
 * Then open comu.json + comu.atlas in Spine 3.8.
 */
const fs = require('fs')
const path = require('path')
const { SkeletonBinary } = require('@pixi-spine/runtime-3.8')

const ROOT = path.resolve(__dirname, '..')

function stripUnityHeader(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const nameLen = view.getUint32(0, true)
  if (nameLen < 1 || nameLen > 200) return buf
  for (let i = 0; i < nameLen; i++) {
    const b = view.getUint8(4 + i)
    if (b < 0x20 || b > 0x7e) return buf
  }
  const nameSection = 4 + nameLen + ((4 - (4 + nameLen) % 4) % 4)
  const headerSize = nameSection + 4
  console.log(`  Stripped ${headerSize}-byte Unity header`)
  return buf.slice(headerSize)
}

function parseSkel(skelPath) {
  const raw = fs.readFileSync(skelPath)
  const stripped = stripUnityHeader(raw)
  // Return attachment stubs so the parser can read skin/animation data
  const loader = {
    newRegionAttachment: (skin, name, path) => ({ type: 'region', name, path, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, width: 0, height: 0, color: { r: 1, g: 1, b: 1, a: 1 } }),
    newMeshAttachment: (skin, name, path) => ({ type: 'mesh', name, path, bones: [], vertices: [], triangles: [], uvs: [], hull: 0, worldVerticesLength: 0, color: { r: 1, g: 1, b: 1, a: 1 } }),
    newBoundingBoxAttachment: (skin, name) => ({ type: 'boundingbox', name, vertices: [], color: { r: 1, g: 1, b: 1, a: 1 } }),
    newClippingAttachment: (skin, name) => ({ type: 'clipping', name, vertices: [], endSlot: null, color: { r: 1, g: 1, b: 1, a: 1 } }),
    newPathAttachment: (skin, name) => ({ type: 'path', name, vertices: [], lengths: [], closed: false, constantSpeed: false, color: { r: 1, g: 1, b: 1, a: 1 } }),
    newPointAttachment: (skin, name) => ({ type: 'point', name, x: 0, y: 0, rotation: 0, color: { r: 1, g: 1, b: 1, a: 1 } }),
  }
  const binary = new SkeletonBinary(loader)
  // Copy to a fresh Uint8Array so BinaryInput's DataView has correct bounds
  const copy = new Uint8Array(stripped)
  const data = binary.readSkeletonData(copy)
  return data
}

function round(v, d = 3) {
  if (typeof v !== 'number' || !isFinite(v)) return v
  const f = Math.pow(10, d)
  return Math.round(v * f) / f
}

const TYPE_MAP = { 'Region': 'region', 'Mesh': 'mesh', 'LinkedMesh': 'linkedmesh', 'BoundingBox': 'boundingbox', 'Path': 'path', 'Point': 'point', 'Clipping': 'clipping' }

function colorToHex(c) {
  if (!c || typeof c !== 'object') return null
  const r = Math.round((c.r ?? 1) * 255)
  const g = Math.round((c.g ?? 1) * 255)
  const b = Math.round((c.b ?? 1) * 255)
  const a = Math.round((c.a ?? 1) * 255)
  const hex = [r, g, b, a].map(v => v.toString(16).padStart(2, '0')).join('')
  return hex === 'ffffffff' ? null : hex
}

function serAtt(att) {
  if (!att) return null
  const t = typeof att.type === 'number' ? (TYPE_MAP[Object.keys(TYPE_MAP)[att.type]] || 'region') : (typeof att.type === 'string' ? att.type.toLowerCase() : 'region')
  const out = { type: t }
  if (att.name) out.name = att.name
  if (att.path) out.path = att.path

  if (t === 'region') {
    out.x = round(att.x)
    out.y = round(att.y)
    out.scaleX = round(att.scaleX)
    out.scaleY = round(att.scaleY)
    out.rotation = round(att.rotation)
    out.width = round(att.width)
    out.height = round(att.height)
  }

  const ch = colorToHex(att.color)
  if (ch) out.color = ch

  if (t === 'mesh' || t === 'linkedmesh') {
    // Spine JSON format uses type "mesh" for both regular and linked meshes
    out.type = 'mesh'
    if (att.triangles) out.triangles = Array.from(att.triangles)
    if (att.regionUVs) out.uvs = Array.from(att.regionUVs).map(v => round(v))
    if (att.uvs) out.uvs = Array.from(att.uvs).map(v => round(v))
    if (att.vertices) {
      out.vertices = Array.from(att.vertices).map(v => round(v))
    }
    if (att.hullLength != null) out.hull = att.hullLength
    if (att.edges && att.edges.length) out.edges = Array.from(att.edges)
    if (att.width) out.width = round(att.width)
    if (att.height) out.height = round(att.height)
  }

  if (t === 'boundingbox' && att.vertices) {
    out.vertices = Array.from(att.vertices).map(v => round(v))
  }

  return out
}

function main() {
  const modelId = process.argv[2]
  const forceVersion = process.argv[3] // optional Spine version override, e.g. 3.8.75
  if (!modelId) {
    console.error('Usage: node scripts/skel2json.cjs <modelId> [versionOverride]')
    console.error('  e.g. node scripts/skel2json.cjs 040ren_002_00 3.8.75')
    process.exit(1)
  }
  const dir = path.join(ROOT, 'public', 'assets', 'spines', modelId)
  const skelPath = path.join(dir, 'comu.skel')
  if (!fs.existsSync(skelPath)) {
    console.error(`Not found: ${skelPath}`)
    process.exit(1)
  }

  console.log(`Reading: ${skelPath}`)
  const data = parseSkel(skelPath)
  console.log(`  Bones: ${data.bones.length}`)
  console.log(`  Slots: ${data.slots.length}`)
  console.log(`  Skins: ${data.skins.length}`)
  console.log(`  Animations: ${data.animations?.length || 0}`)

  // Build JSON
  const json = {}

  // skeleton
  const rawVer = data.version || '3.8.00'
  // Strip any non-standard suffix (e.g. "3.8.84D" → "3.8.84") for Spine editor compat
  let cleanVer = rawVer.replace(/[^0-9.]/g, '')
  // Allow user override for editor compatibility
  if (forceVersion) cleanVer = forceVersion
  json.skeleton = { hash: data.hash || '', spine: cleanVer, width: data.width || 0, height: data.height || 0 }
  if (data.imagesPath) json.skeleton.images = data.imagesPath

  // bones
  json.bones = data.bones.map(b => {
    const o = { name: b.name }
    if (b.parent && b.parent.name !== 'root') o.parent = b.parent.name
    if (b.length) o.length = round(b.length)
    if (b.x) o.x = round(b.x)
    if (b.y) o.y = round(b.y)
    if (b.scaleX !== 1) o.scaleX = round(b.scaleX)
    if (b.scaleY !== 1) o.scaleY = round(b.scaleY)
    if (b.rotation) o.rotation = round(b.rotation)
    if (b.shearX) o.shearX = round(b.shearX)
    if (b.shearY) o.shearY = round(b.shearY)
    // TransformMode: 0=normal, 1=onlyTranslation, 2=noRotationOrReflection, 3=noScale, 4=noScaleOrReflection
    const TFM = ['normal','onlyTranslation','noRotationOrReflection','noScale','noScaleOrReflection']
    if (b.transformMode != null && b.transformMode !== 0) o.transform = TFM[b.transformMode] || b.transformMode
    return o
  })

  // slots
  json.slots = data.slots.map(s => {
    const o = { name: s.name, bone: s.boneData.name }
    const ch = colorToHex(s.color)
    if (ch) o.color = ch
    const dh = colorToHex(s.darkColor)
    if (dh) o.dark = dh
    if (s.attachmentName) o.attachment = s.attachmentName
    // BlendMode: 0=normal, 1=additive, 2=multiply, 3=screen
    const BLM = ['normal','additive','multiply','screen']
    if (s.blendMode != null && s.blendMode !== 0) o.blend = BLM[s.blendMode] || s.blendMode
    return o
  })

  // skins
  json.skins = {}
  data.skins.forEach(skin => {
    const skinObj = {}
    const entries = skin.getAttachments()
    entries.forEach(entry => {
      const slotData = data.slots[entry.slotIndex]
      if (!slotData) return
      if (!skinObj[slotData.name]) skinObj[slotData.name] = {}
      skinObj[slotData.name][entry.name] = serAtt(entry.attachment)
    })
    if (Object.keys(skinObj).length > 0) {
      json.skins[skin.name] = skinObj
      console.log(`  Skin "${skin.name}": ${Object.keys(skinObj).length} slots, ${entries.length} total attachments`)
    }
  })

  // events
  if (data.events && data.events.length > 0) {
    json.events = {}
    data.events.forEach(ev => {
      json.events[ev.name] = { int: ev.intValue || 0, float: ev.floatValue || 0, string: ev.stringValue || '' }
    })
  }

  // Skip animations — skeleton structure only (full animation export is huge and not needed)

  const jsonStr = JSON.stringify(json, null, 2)
  const outPath = path.join(dir, 'comu.json')
  fs.writeFileSync(outPath, jsonStr, 'utf-8')
  console.log(`Written: ${outPath} (${(jsonStr.length / 1024 / 1024).toFixed(1)} MB)`)

  // Also strip Unity header from atlas
  const atlasPath = path.join(dir, 'comu.atlas')
  if (fs.existsSync(atlasPath)) {
    const atlasBuf = fs.readFileSync(atlasPath)
    const cleanedAtlas = stripUnityHeader(atlasBuf)
    const atlasCleanPath = path.join(dir, 'comu_clean.atlas')
    fs.writeFileSync(atlasCleanPath, cleanedAtlas)
    console.log(`Written: ${atlasCleanPath} (${cleanedAtlas.length} bytes)`)
  }

  console.log(`\nImport in Spine: File → Import → Skeleton Data → select comu.json`)
  console.log(`Then set atlas: comu_clean.atlas`)
}

main()
