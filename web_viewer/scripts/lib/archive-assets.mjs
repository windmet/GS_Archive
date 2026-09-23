import path from 'node:path'
import { loadArchiveSources } from './archive-sources.mjs'

/** Node-only resource policy shared by Vite and the standalone HTTP server.
 * URLs passed to the resolver are decoded paths relative to their asset mount.
 * Filesystem reads, HTTP headers and missing-file fallbacks belong to adapters.
 */
export function loadArchiveAssetRoots({ environment = process.env, sources } = {}) {
  sources ||= loadArchiveSources({ environment })
  return {
    lipsync: path.resolve(environment.SIDEM_LIPSYNC_ROOT || sources.legacyPath('scripts', 'lipsyncdata', 'adxlip')),
    audio: path.resolve(environment.SIDEM_AUDIO_ROOT || sources.legacyPath('GS_Res', 'Audio')),
    legacyAudio: path.resolve(environment.SIDEM_LEGACY_AUDIO_ROOT || sources.legacyPath('story_viewer', 'voice_ogg')),
    cardArt: path.resolve(environment.SIDEM_CARD_ART_ROOT || sources.legacyPath('GS_Res', 'ALL_PHOTOS', 'assets', 'resources', 'image', 'image_card')),
  }
}

const AUDIO_DIRS = new Set(['ambient', 'bgm', 'sfx', 'system', 'telephone'])
const SE_DIRS = ['sfx', 'telephone', 'system']
const CARD_DIRS = { portrait: 'image_card_portrait', landscape: 'image_card_landscape' }

export function isWithinRoot(root, filePath) {
  const relative = path.relative(path.resolve(root), path.resolve(filePath))
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

function seAliases(fileName) {
  if (!fileName.endsWith('.ogg')) return []
  const cue = fileName.slice(0, -4)
  if (/^step_(walk|run)_(come|away)_conc_sneaker$/.test(cue)) {
    return [cue.replace(/^step_(walk|run)_(come|away)_conc_sneaker$/, 'group_step_$1_conc_sneaker')]
  }
  if (cue === 'step_walk_come_conc_boot' || cue === 'step_walk_away_conc_boot') {
    return ['step_walk_come_conc_boot_hall', 'step_walk_come_conc_boot_slow']
  }
  return []
}

export function createArchiveAssetResolver(roots = loadArchiveAssetRoots()) {
  return {
    roots,
    audioCandidates(urlPath) {
      const [type, ...parts] = urlPath.replace(/^\/+/, '').split('/')
      const fileName = parts.join('/')
      if (!type || !fileName) return []
      const candidates = []
      const addSe = name => {
        for (const dir of SE_DIRS) candidates.push(path.resolve(roots.audio, dir, name))
        candidates.push(path.resolve(roots.legacyAudio, name))
      }
      if (type === 'se') {
        addSe(fileName)
        for (const alias of seAliases(fileName)) addSe(`${alias}.ogg`)
      } else if (AUDIO_DIRS.has(type)) {
        candidates.push(path.resolve(roots.audio, type, fileName))
        if (type === 'ambient' && fileName.endsWith('_t.ogg')) {
          candidates.push(path.resolve(roots.audio, type, fileName.replace(/_t\.ogg$/, '.ogg')))
        }
      }
      return candidates.filter(file => isWithinRoot(roots.audio, file) || isWithinRoot(roots.legacyAudio, file))
    },
    lipsyncPath(urlPath) {
      const file = path.resolve(roots.lipsync, urlPath.replace(/^\/+/, ''))
      return isWithinRoot(roots.lipsync, file) ? file : null
    },
    cardArtPath(urlPath) {
      const [kind, ...parts] = urlPath.replace(/^\/+/, '').split('/')
      const directory = CARD_DIRS[kind]
      const fileName = parts.join('/')
      if (!directory || !/^image_card_(portrait|landscape)_[a-z0-9_]+\.png$/i.test(fileName)) return null
      const file = path.resolve(roots.cardArt, directory, fileName)
      return isWithinRoot(roots.cardArt, file) ? file : null
    },
  }
}
