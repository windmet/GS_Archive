import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createReadStream, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)
export const repositoryRoot = path.resolve(projectRoot, '..')
export const inventoryPath = path.join(
  projectRoot,
  'policies',
  'tracked-binary-assets.v1.json',
)
export const schemaPath = path.join(
  projectRoot,
  'schemas',
  'tracked-binary-assets-v1.schema.json',
)

function git(...args) {
  return execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function trackedPngPaths() {
  const output = git('ls-files', '--', '*.png')
  return (output ? output.split(/\r?\n/) : [])
    .filter(Boolean)
    .map(filename => `web_viewer/${filename.replaceAll('\\', '/')}`)
    .sort()
}

async function sha256(filename) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filename)) hash.update(chunk)
  return hash.digest('hex')
}

function basenameWithoutExtension(filename) {
  return path.posix.basename(filename, path.posix.extname(filename))
}

function classify(relativePath) {
  const stem = basenameWithoutExtension(relativePath)
  const logicalStem = stem.toLowerCase()
  if (relativePath === 'web_viewer/public/assets/song-chart-sprites/native-note-comparison.png') {
    return { category:'documentation-evidence', logical_id:'documentation-evidence:native-note-comparison',
      consumer:['GS_SONG_NATIVE_NOTE_SPRITES_20261001'], reason_tracked:'derived comparison sheet of verified native sprites, referenced by the rendering audit',
      force_add_allowed:true, owner_release:'2026-10-01-native-song-chart-sprites-001', grandfathered:false }
  }
  if (/^web_viewer\/public\/assets\/song-chart-(sprites|hints|track)\/[A-Za-z0-9_/-]+\.png$/.test(relativePath)) {
    return { category:'stable-promoted-asset', logical_id:`song-chart-native:${relativePath.split("/assets/")[1].toLowerCase().replaceAll("/",":").replace(/\.png$/,"")}`,
      consumer:['SongChartPreview'], reason_tracked:'bounded native Unity note sprites and flick texture cells; SHA and pixel provenance in song-chart rendering audits',
      force_add_allowed:true, owner_release:'2026-10-01-native-song-chart-sprites-001', grandfathered:false }
  }
  if (/^web_viewer\/public\/assets\/song-chart-(combo|effects)\/[A-Za-z0-9_/-]+\.png$/.test(relativePath)) {
    return { category:'stable-promoted-asset', logical_id:`song-chart-native:${relativePath.split("/assets/")[1].toLowerCase().replaceAll("/",":").replace(/\.png$/,"")}`,
      consumer:['SongChartPreview'], reason_tracked:'bounded native Unity hit-effect, combo and 315 milestone textures; SHA and source in the song-hit-effect and combo audits',
      force_add_allowed:true, owner_release:'2026-10-26-native-song-chart-effects-001', grandfathered:false }
  }

  if (relativePath === 'web_viewer/public/assets/portal/image_mobile_background_common.png') {
    return {
      category: 'portal-asset',
      logical_id: 'mobile-portal:background-common',
      consumer: ['ArchivePortalLauncher'],
      reason_tracked: 'user-selected single RAW mobile background; exact Texture2D identity and pixel provenance recorded',
      force_add_allowed: true,
      owner_release: '2026-09-09-mobile-portal-001',
      grandfathered: false,
    }
  }

  if (relativePath.startsWith('web_viewer/notes/')) {
    return {
      category: 'documentation-evidence',
      logical_id: `documentation-evidence:${logicalStem}`,
      consumer: ['project-documentation'],
      reason_tracked: 'grandfathered visual evidence referenced by project notes',
      force_add_allowed: false,
    }
  }

  const attributeIcon = relativePath.match(/^web_viewer\/public\/assets\/attributes\/icon_attribute_(physical|intelli|mental|all)\.png$/)
  if (attributeIcon) return {
    category: 'portal-asset', logical_id: `attribute-icon:${attributeIcon[1]}`,
    consumer: ['ArchiveSongDetail', 'ArchiveCardDetail', 'PortalCardBento', 'ArchiveCollectionCatalog'],
    reason_tracked: 'native icon_attribute_*_big Sprites from the iOS client data.unity3d, trimmed and padded to 64px squares; provenance in docs/ATTRIBUTE_ICONS_20261014.md',
    force_add_allowed: true, owner_release: '2026-10-14-attribute-icons-001', grandfathered: false,
  }

  if (relativePath.includes('/assets/brand/')) {
    return {
      category: 'portal-asset',
      logical_id: `portal-brand:${logicalStem}`,
      consumer: ['archive-shell'],
      reason_tracked: 'grandfathered local portal brand asset',
      force_add_allowed: true,
    }
  }

  const eventMatch = stem.match(/^image_chara_event_story_visual_(.+)$/)
  const storyPortrait = stem.match(/^image_chara_story_visual_(\d{3}[a-z0-9]{3})$/)
  if (storyPortrait && relativePath.includes('/assets/stories/characters/')) return {
    category: 'stable-promoted-asset', logical_id: `story-visual:${storyPortrait[1]}`,
    consumer: ['ArchivePortalOverview'], reason_tracked: 'source-bound single idol archive portrait',
    force_add_allowed: true, owner_release: '2026-10-04-portal-story-portraits-001', grandfathered: false,
  }
  if (eventMatch) {
    return {
      category: 'stable-promoted-asset',
      logical_id: `event-story-visual:${eventMatch[1]}`,
      consumer: ['ArchiveEventDetail', 'ArchiveIdolReference'],
      reason_tracked: 'grandfathered RAW-derived stable event story visual',
      force_add_allowed: true,
    }
  }

  const extraStoryMatch = stem.match(/^image_extra_(banner|kv_story)_(\d+)$/)
  if (extraStoryMatch && relativePath.includes('/assets/stories/extra/')) {
    return {
      category: 'portal-asset',
      logical_id: `extra-story-${extraStoryMatch[1]}:${extraStoryMatch[2]}`,
      consumer: ['ArchiveStoryCatalog', 'ArchiveStoryCollection'],
      reason_tracked: 'bounded RAW-derived Extra Story portal navigation visual',
      force_add_allowed: true,
      owner_release: '2026-07-30-extra-story-visuals-001',
      grandfathered: false,
    }
  }

  const songJacketMatch = stem.match(/^jacket_([a-z0-9]+)$/)
  if (songJacketMatch && relativePath.includes('/assets/songs/')) {
    return {
      category: 'stable-promoted-asset',
      logical_id: `song-jacket:${songJacketMatch[1]}`,
      consumer: ['ArchiveSongCatalog', 'ArchiveSongDetail'],
      reason_tracked: 'bounded RAW-derived song navigation cover with exact Unity relation index',
      force_add_allowed: true,
      owner_release: '2026-08-01-song-jackets-001',
      grandfathered: false,
      exception_review: {
        approved: true,
        reason: 'the complete 61-work navigation set is reviewed as one atomic offline archive batch',
        object_storage_unsuitable: 'the archive is local-first and the covers are required for stable offline navigation',
        update_frequency: 'one-time snapshot-derived publication',
        rollback_plan: 'remove the owner release assets and regenerate the jacket index and binary inventory',
        explicit_user_approval: false,
      },
    }
  }

  if (relativePath.includes('/assets/silhouette/')) {
    return {
      category: 'test-fixture',
      logical_id: `story-silhouette:${logicalStem}`,
      consumer: ['StoryViewer', 'verify:silhouette'],
      reason_tracked: 'grandfathered minimal silhouette runtime fixture',
      force_add_allowed: true,
    }
  }

  const birthdayMatch = stem.match(/^image_chara_birthday_visual_(.+)$/)
  if (birthdayMatch) {
    return {
      category: 'stable-promoted-asset',
      logical_id: `birthday-visual:${birthdayMatch[1]}`,
      consumer: ['ArchivePortalOverview'],
      reason_tracked: 'grandfathered RAW-derived stable birthday story visual',
      force_add_allowed: true,
    }
  }

  const unitMatch = stem.match(/^image_unit_logo_(.+)$/)
  if (unitMatch) {
    return {
      category: 'portal-asset',
      logical_id: `unit-logo:${unitMatch[1]}`,
      consumer: ['ArchiveHome', 'ArchivePortalOverview', 'ArchiveMobileArchive'],
      reason_tracked: 'grandfathered local unit navigation asset',
      force_add_allowed: true,
    }
  }

  const stageNativeTexture = relativePath.match(/^web_viewer\/public\/data\/(stage-object-emitters|stage-searchlights|stage-whole-screen|stage-backmonitor-logos|stage-new-suspension-sprites|stage-built-in-objects|stage-smoke)\//)
  if (stageNativeTexture) {
    return {
      category: 'stable-promoted-asset',
      logical_id: `${stageNativeTexture[1]}:${logicalStem}`,
      consumer: ['ChibiStageViewer'],
      reason_tracked: 'RAW-derived native stage effect texture; identity is serialized file + PathID and the filename is its SHA-256 prefix',
      force_add_allowed: false,
      owner_release: stageNativeTexture[1]==='stage-object-emitters' && ["9530f2442e6cc6e2561ed2c2","91279b424b690b79d6dcbdc1","517297414a5a24a2cbcd35e7"].includes(logicalStem)
        ? '2026-10-23-native-bnckgy-fire-001'
        : stageNativeTexture[1]==='stage-object-emitters' && ["07e0faa2a7954f8825653bd9","49551f60ab5846e295a9c8b5","efde3136a9e0b781fd9af124"].includes(logicalStem)
        ? '2026-10-22-native-tktkkt-electric-001'
        : stageNativeTexture[1]==='stage-object-emitters' && ["99916964340aad44a43cf51c"].includes(logicalStem)
        ? '2026-10-22-native-pcuslv-bloom-001'
        : stageNativeTexture[1]==='stage-object-emitters' && ["7130baf7f1ca4fa3ae87d306","b1f6480822e2074beb75c1e5","e014c42f55d0f8e56d961057"].includes(logicalStem)
        ? '2026-10-22-native-pavetl-torus-001'
        : stageNativeTexture[1]==='stage-built-in-objects'
        ? '2026-10-20-apk-built-in-objects-001'
        : stageNativeTexture[1]==='stage-new-suspension-sprites'
        ? '2026-10-20-native-suspension-sprites-001'
        : stageNativeTexture[1]==='stage-backmonitor-logos'
        ? '2026-10-19-native-backmonitor-logos-001'
        : stageNativeTexture[1]==='stage-object-emitters' && ["a81de17be6dfb373a4d35149","71defddbb53db923a0d9b86d"].includes(logicalStem)
        ? '2026-10-22-native-jfhtmk-panel-001'
        : stageNativeTexture[1]==='stage-object-emitters' && ["979df7f87c603a9a755b4541","9769050e6fb1fe5f30004a47","39750b57bcd9457fae273951","c9cea295b9c3adbfe443e3a4"].includes(logicalStem)
        ? '2026-10-22-native-local-panels-001'
        : stageNativeTexture[1]==='stage-object-emitters' && ["f161574dfb114a551856d7d7","f28fab56c8b010ae67658e9e","1c5ef5b6904c30a23586aa62"].includes(logicalStem)
        ? '2026-10-21-native-pfofos-fire-001'
        : stageNativeTexture[1]==='stage-object-emitters' && logicalStem==='b962010c7c2a646d278d5902'
        ? '2026-10-21-native-remasq-shockwave-001'
        : stageNativeTexture[1]==='stage-object-emitters' && ['4656ebbb76b55f096bd8b96b','117ecfff396a16a280c130e0','b8231c13079012d34ecab120','1781f14b84ef34379aca979b'].includes(logicalStem)
        ? '2026-10-21-native-mainha-panels-001'
        : stageNativeTexture[1]==='stage-object-emitters' && ['bdac441632e29445db51ea8b','d8109e6ab1dd216f5cc8c6f4','2a934e4258f11b3d00f43841','5bf134aa0c50a48b4e174f88'].includes(logicalStem)
        ? '2026-10-21-native-ossshd-panel-001'
        : stageNativeTexture[1]==='stage-object-emitters' && ['311c4f525f7c85111edfa035','3b5dc517006c69c8b7e9c383','70070f4d8534abe4033b757b','eaf6e6b1839545e535e4ecce'].includes(logicalStem)
        ? '2026-10-21-native-sakura-followup-001'
        : stageNativeTexture[1]==='stage-object-emitters' && ['732271f8d5859572f2fa1ef1','e0cf2224571e1c8f2b7a5389'].includes(logicalStem)
        ? '2026-10-21-native-smoke-followup-001'
        : stageNativeTexture[1]==='stage-object-emitters' && logicalStem==='eb3a3173cac5f7665d31638a'
        ? '2026-10-20-native-rehobe-smoke-001'
        : stageNativeTexture[1]==='stage-object-emitters' && ['866092bffcd833f1041a2e7d','e192ddf6239b66e93c672199','e6daf431ce6a295fa54a79b8'].includes(logicalStem)
          ? '2026-10-19-native-mtples-formula-001'
        : stageNativeTexture[1]==='stage-smoke'
          ? '2026-10-23-native-smoke-preview-001' : '2026-10-17-native-stage-textures-001',
      grandfathered: false,
    }
  }

  if (relativePath.includes('/public/data/fx_extracted/')) {
    return {
      category: 'stable-promoted-asset',
      logical_id: `story-fx:${logicalStem}`,
      consumer: ['StoryViewer'],
      reason_tracked: 'grandfathered generated FX image used by the story runtime',
      force_add_allowed: false,
    }
  }

  throw new Error(`Tracked PNG has no binary-policy classification: ${relativePath}`)
}

export async function generateTrackedBinaryInventory({
  captureCommit,
  generatedAt,
} = {}) {
  const commit = captureCommit || git('rev-parse', 'HEAD')
  const timestamp = generatedAt || git('show', '-s', '--format=%cI', commit)
  const entries = []

  for (const relativePath of trackedPngPaths()) {
    const filename = path.resolve(repositoryRoot, relativePath)
    const classification = classify(relativePath)
    entries.push({
      path: relativePath,
      bytes: statSync(filename).size,
      sha256: await sha256(filename),
      ...classification,
      owner_release: classification.owner_release ?? null,
      grandfathered: classification.grandfathered ?? true,
    })
  }

  return {
    schema_version: 1,
    generated_at: timestamp,
    generated_from_commit: commit,
    governed_extensions: ['png'],
    summary: {
      files: entries.length,
      bytes: entries.reduce((total, entry) => total + entry.bytes, 0),
      grandfathered_files: entries.filter(entry => entry.grandfathered).length,
      new_policy_files: entries.filter(entry => !entry.grandfathered).length,
    },
    entries,
  }
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}
