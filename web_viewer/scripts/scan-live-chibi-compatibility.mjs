import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import * as PIXI from 'pixi.js'
import {
  BoundingBoxAttachment,
  ClippingAttachment,
  MeshAttachment,
  PathAttachment,
  PointAttachment,
  RegionAttachment,
  SkeletonBinary,
  Skin,
} from '@pixi-spine/runtime-3.8'
import { TextureAtlasRegion } from '@pixi-spine/base'

const projectRoot = path.resolve(import.meta.dirname, '..')
const assetRoot = path.join(projectRoot, 'public', 'assets', 'live-chibi')

function dummyRegion(name) {
  const region = new TextureAtlasRegion()
  region.name = name
  region.texture = PIXI.Texture.EMPTY
  return region
}

class AttachmentPathCollector {
  paths = new Set()

  remember(pathName) {
    if (pathName) this.paths.add(pathName)
  }

  newRegionAttachment(_skin, name, pathName) {
    this.remember(pathName)
    const attachment = new RegionAttachment(name)
    attachment.path = pathName
    attachment.region = dummyRegion(pathName)
    return attachment
  }

  newMeshAttachment(_skin, name, pathName) {
    this.remember(pathName)
    const attachment = new MeshAttachment(name)
    attachment.path = pathName
    attachment.region = dummyRegion(pathName)
    return attachment
  }

  newBoundingBoxAttachment(_skin, name) { return new BoundingBoxAttachment(name) }
  newPathAttachment(_skin, name) { return new PathAttachment(name) }
  newPointAttachment(_skin, name) { return new PointAttachment(name) }
  newClippingAttachment(_skin, name) { return new ClippingAttachment(name) }
}

function atlasRegions(text) {
  const lines = text.split(/\r?\n/)
  const regions = new Set()
  for (let index = 0; index < lines.length - 1; index += 1) {
    const name = lines[index].trim()
    if (name && lines[index + 1].trim().startsWith('rotate:')) regions.add(name)
  }
  return regions
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
}

const manifest = JSON.parse(await readFile(path.join(assetRoot, 'manifest.json'), 'utf8'))
const setupByBody = new Map()
for (const bodyType of [1, 2, 3, 4, 5]) {
  const collector = new AttachmentPathCollector()
  const parser = new SkeletonBinary(collector)
  const skeletonData = parser.readSkeletonData(
    new Uint8Array(await readFile(path.join(assetRoot, 'setup', `body-${bodyType}.skel`))),
  )
  const activeSkin = new Skin('active-costume')
  for (const skinName of ['body', 'head', 'cos_defo']) {
    const skin = skeletonData.findSkin(skinName)
    if (skin) activeSkin.addSkin(skin)
  }
  const entriesBySlot = new Map()
  for (const entry of activeSkin.getAttachments()) {
    if (!entriesBySlot.has(entry.slotIndex)) entriesBySlot.set(entry.slotIndex, [])
    entriesBySlot.get(entry.slotIndex).push(entry)
  }
  setupByBody.set(bodyType, {
    paths: collector.paths,
    skeletonData,
    activeSkin,
    entriesBySlot,
    skinPaths: Object.fromEntries(skeletonData.skins.map(skin => [
      skin.name,
      [...new Set(skin.getAttachments().map(entry => entry.attachment?.path).filter(Boolean))],
    ])),
  })
}

const results = []
for (const character of manifest.characters) {
  const setup = setupByBody.get(character.bodyType)
  const required = setup.paths
  for (const costume of character.costumes) {
    const available = atlasRegions(await readFile(path.join(assetRoot, costume.atlas), 'utf8'))
    const matched = [...required].filter(region => available.has(region))
    const missing = [...required].filter(region => !available.has(region))
    const skinMatches = Object.fromEntries(Object.entries(setup.skinPaths)
      .map(([skinName, paths]) => [skinName, paths.filter(region => available.has(region)).length])
      .filter(([, count]) => count > 0))
    const recoverableSlots = []
    for (let slotIndex = 0; slotIndex < setup.skeletonData.slots.length; slotIndex += 1) {
      const slot = setup.skeletonData.slots[slotIndex]
      const setupAttachment = slot.attachmentName
        ? setup.activeSkin.getAttachment(slotIndex, slot.attachmentName)
        : null
      if (!setupAttachment?.path || available.has(setupAttachment.path)) continue
      const candidates = (setup.entriesBySlot.get(slotIndex) || [])
        .filter(entry => entry.attachment?.path && available.has(entry.attachment.path))
        .sort((left, right) => Number(left.name.endsWith('_fl')) - Number(right.name.endsWith('_fl')))
      if (candidates.length) {
        recoverableSlots.push({
          slot: slot.name,
          setupAttachment: slot.attachmentName,
          setupPath: setupAttachment.path,
          candidates: candidates.slice(0, 8).map(entry => ({
            name: entry.name,
            path: entry.attachment.path,
          })),
        })
      }
    }
    results.push({
      modelId: `${character.id}_${costume.id}`,
      idolId: character.id,
      bodyType: character.bodyType,
      requiredRegions: required.size,
      atlasRegions: available.size,
      matchedRegions: matched.length,
      missingRegions: missing.length,
      recoverableSlots: recoverableSlots.length,
      recoverableSample: recoverableSlots.slice(0, 20),
      skinMatches,
      coverage: Number((matched.length / Math.max(required.size, 1)).toFixed(4)),
      missingSample: missing.slice(0, 20),
    })
  }
}

const bodySummaries = {}
for (const bodyType of [1, 2, 3, 4, 5]) {
  const bodyResults = results.filter(item => item.bodyType === bodyType)
  const medianCoverage = median(bodyResults.map(item => item.coverage))
  const medianRegionCount = median(bodyResults.map(item => item.atlasRegions))
  bodySummaries[bodyType] = {
    costumes: bodyResults.length,
    requiredRegions: setupByBody.get(bodyType).paths.size,
    skinNames: setupByBody.get(bodyType).skeletonData.skins.map(skin => skin.name),
    medianCoverage,
    medianAtlasRegions: medianRegionCount,
  }
  for (const item of bodyResults) {
    item.outlier = item.coverage < medianCoverage - 0.05
      || item.atlasRegions < medianRegionCount * 0.75
  }
}

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  summary: {
    characters: manifest.characters.length,
    costumes: results.length,
    outliers: results.filter(item => item.outlier).length,
    bodyTypes: bodySummaries,
  },
  costumes: results,
}
await writeFile(
  path.join(assetRoot, 'compatibility-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
)
console.log(JSON.stringify(report.summary, null, 2))
