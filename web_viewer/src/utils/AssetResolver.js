/**
 * AssetResolver — single source of truth for all asset URL resolution.
 *
 * All path/URL logic lives here. When deploying to a CDN or R2 storage,
 * only this file needs to change (e.g., prepend a base URL).
 *
 * Asset directory structure (expected in /public/assets/):
 *   assets/bg/{bgId}.png
 *   assets/audio/bgm/{bgmId}.ogg    (proxied via Vite dev middleware)
 *   assets/audio/se/{cueName}.ogg   (proxied — searches sfx/telephone/system dirs)
 *   assets/audio/ambient/{cue}.ogg  (proxied — strips _t suffix for file lookup)
 *   assets/spine/{modelId}/comu.atlas
 *   assets/spine/{modelId}/comu.skel
 *   assets/spine/{modelId}/faces/{faceName}.png
 *   assets/voice/{voiceFile}
 */

const ASSET_BASE = '/assets'
export const SILHOUETTE_ONLY_MODEL_IDS = Object.freeze([
  '102sha_001_00',
])
const SILHOUETTE_ONLY_MODELS = new Set(SILHOUETTE_ONLY_MODEL_IDS)

export function getBgUrl(bgId) {
  return `${ASSET_BASE}/bg/${bgId}.png`
}

export function getBgmUrl(bgmId) {
  return `${ASSET_BASE}/audio/bgm/${bgmId}.ogg`
}

/**
 * Sound effect (SE) — footsteps, phone rings, door knocks, etc.
 * The dev middleware searches sfx/, telephone/, and system/ directories.
 */
export function getSeUrl(cueName) {
  return `${ASSET_BASE}/audio/se/${cueName}.ogg`
}

/**
 * Ambient/environmental audio — background atmosphere (cafe, rain, traffic, etc.)
 * The dev middleware handles _t suffix stripping for file lookup.
 */
export function getAmbientUrl(cueName) {
  return `${ASSET_BASE}/audio/ambient/${cueName}.ogg`
}

export function getSpineAtlasUrl(modelId) {
  return `${ASSET_BASE}/spines/${modelId}/comu.atlas`
}

export function getSpineSkelUrl(modelId) {
  return `${ASSET_BASE}/spines/${modelId}/comu.skel`
}

/**
 * Face texture URL for spine models.
 * Actual files on disk: image_photo_face_icon_{modelId}_{faceName}.png
 * e.g. image_photo_face_icon_001tom_002_00_face_joy.png
 */
export function getSpineFaceUrl(modelId, faceName) {
  return `${ASSET_BASE}/spines/${modelId}/faces/image_photo_face_icon_${modelId}_${faceName}.png`
}

/**
 * Resolve the full URL for a voice file.
 * Some scenario data stores short filenames (e.g. "a1001.m4a") while the
 * actual file on disk has a scenario prefix (e.g. "1_1_001_03_a1001.m4a").
 * The prefix is derived from the scenario_id: the last 4 underscore-delimited tokens.
 *
 * Voice files containing underscores (e.g. "2_1_001_01_00_09.m4a")
 * are already fully qualified and used as-is.
 *
 * @param {string} voiceFile - raw voice field from scenario data
 * @param {string} [scenarioId] - scenario_id, used to derive prefix for short names
 * @returns {string} resolved asset URL
 */
function collapseDuplicatedVoicePrefix(filename) {
  const extensionIndex = filename.lastIndexOf('.')
  const stem = extensionIndex >= 0 ? filename.slice(0, extensionIndex) : filename
  const extension = extensionIndex >= 0 ? filename.slice(extensionIndex) : ''
  const parts = stem.split('_')
  for (let width = 2; width * 2 < parts.length; width += 1) {
    if (parts.slice(0, width).join('_') === parts.slice(width, width * 2).join('_')) {
      return `${parts.slice(width).join('_')}${extension}`
    }
  }
  return filename
}

function expandVoiceAliases(filename) {
  const aliases = [filename]
  const add = value => {
    if (value && !aliases.includes(value)) aliases.push(value)
  }
  const transforms = [
    value => value.replace(/_t\d+_/gi, '_'),
    value => value.replace(/_([a-z])_\1(?=\d)/gi, '_$1'),
    value => value.replace(/^5_01_999_\d+_5_01_/, '5_01_'),
    collapseDuplicatedVoicePrefix,
  ]

  for (let index = 0; index < aliases.length; index += 1) {
    for (const transform of transforms) add(transform(aliases[index]))
  }
  return aliases
}

function scenarioVoicePrefixes(scenarioId, voiceFile) {
  if (!scenarioId) return []
  const parts = String(scenarioId).replace(/^scenario_/, '').split('_')
  const prefixes = []
  const add = value => {
    if (value.length && !prefixes.some(prefix => prefix.join('_') === value.join('_'))) prefixes.push(value)
  }

  // Synthetic archive ids such as 3_x_001tom_3_1_001 retain the source
  // category and idol code before the real audio-bank prefix.
  if (/^[34]$/i.test(parts[0]) && parts[1] === 'x' && /^\d{3}[a-z]{3}$/i.test(parts[2])) {
    add(parts.slice(3))
  }
  if (/^\d{3}[a-z]{3}$/i.test(parts[0])) add(parts.slice(1))
  if (/^[a-z]$/i.test(parts.at(-1)) && String(voiceFile).startsWith(parts.at(-1))) {
    add(parts.slice(0, -1))
    add(parts.slice(-5, -1))
  }
  add(parts.slice(-4))
  add(parts)
  return prefixes
}

export function resolveVoiceFilenameCandidates(voiceFile, scenarioId) {
  if (!voiceFile) return []
  const raw = String(voiceFile)
  const baseNames = raw.includes('_')
    ? [raw]
    : scenarioVoicePrefixes(scenarioId, raw).map(prefix => `${prefix.join('_')}_${raw}`)
  if (!baseNames.length) baseNames.push(raw)
  return [...new Set(baseNames.flatMap(expandVoiceAliases))]
}

export function getVoiceUrlCandidates(voiceFile, scenarioId) {
  return resolveVoiceFilenameCandidates(voiceFile, scenarioId)
    .map(filename => `${ASSET_BASE}/voice/${filename}`)
}

export function getVoiceUrl(voiceFile, scenarioId) {
  return getVoiceUrlCandidates(voiceFile, scenarioId)[0] || `${ASSET_BASE}/voice/${voiceFile}`
}

/**
 * Original game lip-sync scale JSON.
 * Compiled scenarios store paths such as:
 *   adxlip/001tom/2_1_001_01/2_1_001_01_00_09.json
 */
export function getLipSyncUrl(lipPath) {
  if (!lipPath) return ''
  const clean = String(lipPath).replace(/^\/+/, '')
  return `${ASSET_BASE}/lipsync/${clean}`
}

/**
 * Per-character mouth configuration (idolmouthsetting).
 * Maps each expression to its open/close mouth scale and attachment names.
 */
export function getMouthSettingUrl(idolId) {
  return `/data/idolsetting/mouth/idol_mouth_stg_${idolId}.json`
}

/**
 * Per-character default offset (idolothersetting).
 * Provides default X/Y position offset for each character's spine.
 */
export function getOtherSettingUrl(idolId) {
  return `/data/idolsetting/other/idol_other_stg_${idolId}.json`
}

export function getBodyTypeUrl() {
  return `/data/idolsetting/body_type.json`
}

/**
 * Mobile phone UI assets — indexed by chara_id (e.g. "001tom").
 */
export function getMobileBgUrl(charaId) {
  return `${ASSET_BASE}/idols/mobile_bg/image_chara_mobile_background_${charaId}.png`
}

export function getMobileIconUrl(charaId) {
  return `${ASSET_BASE}/idols/mobile_icons/image_chara_mobile_icon_${charaId}.png`
}

export function getCharaIconUrl(charaId) {
  return `${ASSET_BASE}/idols/icons/image_chara_icon_${charaId}.png`
}

/**
 * Unit mobile backgrounds — indexed by unit code (e.g. "001jup").
 */
export function getUnitMobileBgUrl(unitId) {
  return `${ASSET_BASE}/units/mobile_bg/image_unit_mobile_background_${unitId}.png`
}

export function getUnitLogoUrl(unitId) {
  return `${ASSET_BASE}/units/logos/image_unit_logo_${unitId}.png`
}

export function getBrandMarkUrl() {
  return `${ASSET_BASE}/brand/image_logo_imas_M_mark.png`
}

export function getEventBannerUrl(eventCode) {
  return `${ASSET_BASE}/events/banners/image_home_announce_event_${eventCode}_01.png`
}

/**
 * Chat emoji images.
 */
export function getEmojiUrl(emojiId) {
  return `${ASSET_BASE}/emojis/${emojiId}.png`
}

/**
 * Stamp (large chat sticker) images.
 */
export function getStampUrl(stampId) {
  return `${ASSET_BASE}/stamps/${stampId}.png`
}

/**
 * Effect textures (bg effects like cameraflare spritesheets).
 * Frame-based effects follow the pattern: {effectName}_{frameIndex}.png
 */
export function getEffectUrl(effectName, frameIndex) {
  return `/data/fx_extracted/${effectName}_${frameIndex}.png`
}

/**
 * Silhouette PNG URLs for NPC/non-idol characters that have no Spine model.
 */
export function getSilhouetteUrl(modelId) {
  return `${ASSET_BASE}/silhouette/${modelId}.png`
}

/**
 * Models with an audited PNG stage portrait and no corresponding Spine rig.
 * Keep this explicit so the runtime does not probe known-missing Spine URLs
 * before using the deliberate fallback.
 */
export function isSilhouetteOnlyModel(modelId) {
  return SILHOUETTE_ONLY_MODELS.has(String(modelId || ''))
}
