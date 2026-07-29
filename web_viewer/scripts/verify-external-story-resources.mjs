import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const viewerRoot = path.resolve(scriptDirectory, '..')
const paths = {
  registry: path.join(viewerRoot, 'public', 'data', 'external_story_resources.json'),
  schema: path.join(viewerRoot, 'schemas', 'external-story-resource-v1.schema.json'),
  events: path.join(viewerRoot, 'public', 'data', 'masterdata', 'event_index.json'),
  stories: path.join(viewerRoot, 'public', 'data', 'masterdata', 'story_presentation_index.json'),
}

const readJson = filePath => readFile(filePath, 'utf8').then(JSON.parse)
const [registry, schema, eventIndex, storyIndex] = await Promise.all(
  Object.values(paths).map(readJson),
)

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
const validate = ajv.compile(schema)
const errors = []

if (!validate(registry)) {
  validate.errors.forEach(error => {
    errors.push(`${error.instancePath || '/'} ${error.message}`)
  })
}

const eventByCode = new Map(
  (eventIndex.events || []).map(event => [String(event.event_code), event]),
)
const storiesByScenarioId = new Map(
  Object.values(storyIndex.by_file || {}).map(story => [story.scenario_id, story]),
)
const externalIds = new Set()
const bvids = new Set()
const forbiddenEvidence = /\b(?:mobage|cd drama|live-event|anime|unknown-product)\b/i

for (const [index, entry] of (registry.entries || []).entries()) {
  const label = `entries[${index}]`
  const { bvid, canonical_url: canonicalUrl } = entry.platform || {}

  if (externalIds.has(entry.external_id)) {
    errors.push(`${label} duplicates external_id ${entry.external_id}`)
  }
  externalIds.add(entry.external_id)

  if (bvids.has(bvid)) {
    errors.push(`${label} duplicates BVID ${bvid}`)
  }
  bvids.add(bvid)

  if (entry.external_id !== `bilibili:${bvid}`) {
    errors.push(`${label} external_id does not agree with BVID ${bvid}`)
  }
  if (canonicalUrl !== `https://www.bilibili.com/video/${bvid}`) {
    errors.push(`${label} canonical URL does not agree with BVID ${bvid}`)
  }
  if (entry.visual?.url !== null) {
    errors.push(`${label} must not use a remote visual URL`)
  }

  const mapping = entry.internal_mapping || {}
  if (mapping.evidence?.some(item => forbiddenEvidence.test(item))) {
    errors.push(`${label} evidence contains a forbidden non-GS category`)
  }

  if (mapping.state === 'exact-event') {
    const event = eventByCode.get(mapping.event_id)
    if (!event) {
      errors.push(`${label} references missing event ${mapping.event_id}`)
      continue
    }

    for (const storyResourceId of mapping.story_resource_ids || []) {
      const story = storiesByScenarioId.get(storyResourceId)
      if (!story) {
        errors.push(`${label} references missing story ${storyResourceId}`)
        continue
      }

      const eventEpisodeIds = (event.story_reward_cards || [])
        .map(reward => reward.episode_resource_id)
        .filter(Boolean)
      const belongsToEvent = eventEpisodeIds.some(
        episodeId => episodeId === storyResourceId || episodeId.startsWith(`${storyResourceId}_`),
      )
      if (!belongsToEvent) {
        errors.push(
          `${label} story ${storyResourceId} is not linked from event ${mapping.event_id}`,
        )
      }
    }
  }

  if (mapping.state === 'exact-unit-story') {
    if (mapping.event_id !== null) {
      errors.push(`${label} exact unit story must not carry an event ID`)
    }
    if ((mapping.story_resource_ids || []).length !== 0) {
      errors.push(`${label} exact unit story must use collection IDs only`)
    }
    for (const collectionId of mapping.collection_ids || []) {
      const story = storiesByScenarioId.get(collectionId)
      if (!story) {
        errors.push(`${label} references missing unit-story collection ${collectionId}`)
        continue
      }
      if (!collectionId.startsWith('1_1_')) {
        errors.push(`${label} collection ${collectionId} is not a unit story`)
      }
      if (!Array.isArray(story.episodes) || story.episodes.length < 1) {
        errors.push(`${label} collection ${collectionId} has no episode boundary`)
      }
    }
  }
}

if (errors.length > 0) {
  console.error('External Story resource verification failed:')
  errors.forEach(error => console.error(`- ${error}`))
  process.exitCode = 1
} else {
  const exactCount = registry.entries.filter(entry =>
    entry.internal_mapping.state.startsWith('exact-'),
  ).length
  console.log(
    `External Story resources verified: ${registry.entries.length} GS records / ` +
    `${exactCount} exact mappings / ${bvids.size} unique BVIDs`,
  )
}
