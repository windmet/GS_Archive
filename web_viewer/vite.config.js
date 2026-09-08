import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'
import { createArchiveAssetResolver } from './scripts/lib/archive-assets.mjs'

const assetResolver = createArchiveAssetResolver()
const STORY_CANDIDATE_ROOT = path.resolve(
  process.env.SIDEM_STORY_CANDIDATE_ROOT || '.analysis/raw-migration',
)
const CARD_CANDIDATE_ROOT = path.resolve(
  process.env.SIDEM_CARD_CANDIDATE_ROOT || '.analysis/raw-migration/card',
)
const BACKGROUND_CANDIDATE_ROOT = path.resolve(
  process.env.SIDEM_BACKGROUND_CANDIDATE_ROOT || '.analysis/raw-migration/background',
)
const AUDIO_CANDIDATE_ROOT = path.resolve(
  process.env.SIDEM_AUDIO_CANDIDATE_ROOT || '.analysis/raw-migration/audio',
)
const CHARACTER_IMAGE_CANDIDATE_ROOT = path.resolve(
  process.env.SIDEM_CHARACTER_IMAGE_CANDIDATE_ROOT ||
    '.analysis/raw-migration/character-image-candidate',
)
const CHARACTER_IMAGE_CANDIDATE_KINDS = new Set([
  'birthday_visual',
  'event_story_visual',
  'mobile_bustup',
  'name_plate',
  'sign',
  'story_visual',
])

function lipsyncStaticPlugin() {
  return {
    name: 'sidem-lipsync-static',
    configureServer(server) {
      server.middlewares.use('/assets/lipsync/adxlip', (req, res, next) => {
        const rawUrl = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const filePath = assetResolver.lipsyncPath(rawUrl)
        if (!filePath) {
          res.statusCode = 403
          res.end('Forbidden')
          return
        }
        fs.readFile(filePath, (err, data) => {
          if (err) {
            next()
            return
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(data)
        })
      })
    },
  }
}

/**
 * Vite middleware to serve audio (SE/environmental/BGM/system) from GS_Res/Audio/.
 * The frontend requests /assets/audio/{type}/{cue}.ogg, and this middleware
 * delegates ordered resource lookup to the shared archive asset resolver.
 *
 * SE cues can be in sfx/, telephone/, or system/ — the middleware tries each.
 * Ambient cues with _t suffix try both with and without the suffix.
 */
function audioPlugin() {
  return {
    name: 'sidem-audio',
    configureServer(server) {
      server.middlewares.use('/assets/audio', (req, res, next) => {
        const rawUrl = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        for (const fp of assetResolver.audioCandidates(rawUrl)) {
          if (fs.existsSync(fp)) {
            res.setHeader('Content-Type', 'audio/ogg')
            const stream = fs.createReadStream(fp)
            stream.pipe(res)
            stream.on('error', () => { res.statusCode = 500; res.end() })
            return
          }
        }
        // Not found: let Vite handle (will 404)
        next()
      })
    },
  }
}

function cardArtPlugin() {
  return {
    name: 'sidem-card-art',
    configureServer(server) {
      server.middlewares.use('/assets/card-art', (req, res, next) => {
        const rawUrl = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const filePath = assetResolver.cardArtPath(rawUrl)
        if (!filePath || !fs.existsSync(filePath)) {
          next()
          return
        }
        res.setHeader('Content-Type', 'image/png')
        res.setHeader('Cache-Control', 'public, max-age=86400')
        fs.createReadStream(filePath).pipe(res)
      })
    },
  }
}

function rawStoryCandidatePlugin() {
  return {
    name: 'sidem-raw-story-candidate',
    configureServer(server) {
      server.middlewares.use('/data/compiled/candidate', (req, res, next) => {
        const fileName = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        if (!/^[a-z0-9_]+\.json$/i.test(fileName)) {
          next()
          return
        }
        const scenarioId = fileName.replace(/\.json$/i, '')
        const filePath = path.resolve(
          STORY_CANDIDATE_ROOT,
          scenarioId,
          'compiled',
          'authoritative',
          fileName,
        )
        if (
          !filePath.startsWith(STORY_CANDIDATE_ROOT + path.sep) ||
          !fs.existsSync(filePath)
        ) {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(filePath).pipe(res)
      })
    },
  }
}

function rawCardCandidatePlugin() {
  return {
    name: 'sidem-raw-card-candidate',
    configureServer(server) {
      server.middlewares.use('/assets/card-candidate', (req, res, next) => {
        const rawUrl = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const [resourceId, fileName, ...rest] = rawUrl.split('/')
        if (
          rest.length ||
          !/^[a-z0-9_]+$/i.test(resourceId || '') ||
          !/^image_card_[a-z0-9_]+\.png$/i.test(fileName || '')
        ) {
          next()
          return
        }
        const filePath = path.resolve(CARD_CANDIDATE_ROOT, resourceId, 'resolved', fileName)
        if (
          !filePath.startsWith(CARD_CANDIDATE_ROOT + path.sep) ||
          !fs.existsSync(filePath)
        ) {
          next()
          return
        }
        res.setHeader('Content-Type', 'image/png')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(filePath).pipe(res)
      })

      server.middlewares.use('/data/card-candidate', (req, res, next) => {
        const fileName = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        if (!/^[a-z0-9_]+\.json$/i.test(fileName)) {
          next()
          return
        }
        const resourceId = fileName.replace(/\.json$/i, '')
        const filePath = path.resolve(CARD_CANDIDATE_ROOT, resourceId, 'candidate.json')
        if (
          !filePath.startsWith(CARD_CANDIDATE_ROOT + path.sep) ||
          !fs.existsSync(filePath)
        ) {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(filePath).pipe(res)
      })
    },
  }
}

function rawBackgroundCandidatePlugin() {
  return {
    name: 'sidem-raw-background-candidate',
    configureServer(server) {
      server.middlewares.use('/assets/bg-candidate', (req, res, next) => {
        const fileName = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        if (!/^[a-z0-9_]+\.png$/i.test(fileName)) {
          next()
          return
        }
        const backgroundId = fileName.replace(/\.png$/i, '')
        const filePath = path.resolve(
          BACKGROUND_CANDIDATE_ROOT,
          backgroundId,
          'resolved',
          fileName,
        )
        if (
          !filePath.startsWith(BACKGROUND_CANDIDATE_ROOT + path.sep) ||
          !fs.existsSync(filePath)
        ) {
          next()
          return
        }
        res.setHeader('Content-Type', 'image/png')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(filePath).pipe(res)
      })

      server.middlewares.use('/data/background-candidate', (req, res, next) => {
        const fileName = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        if (!/^[a-z0-9_]+\.json$/i.test(fileName)) {
          next()
          return
        }
        const backgroundId = fileName.replace(/\.json$/i, '')
        const filePath = path.resolve(
          BACKGROUND_CANDIDATE_ROOT,
          backgroundId,
          'candidate.json',
        )
        if (
          !filePath.startsWith(BACKGROUND_CANDIDATE_ROOT + path.sep) ||
          !fs.existsSync(filePath)
        ) {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(filePath).pipe(res)
      })
    },
  }
}

function rawCharacterImageCandidatePlugin() {
  return {
    name: 'sidem-raw-character-image-candidate',
    configureServer(server) {
      server.middlewares.use('/assets/character-candidate', (req, res, next) => {
        const rawUrl = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const [kind, fileName, ...rest] = rawUrl.split('/')
        if (
          rest.length ||
          !CHARACTER_IMAGE_CANDIDATE_KINDS.has(kind) ||
          !/^\d{3}[a-z0-9]{3}\.png$/i.test(fileName || '')
        ) {
          next()
          return
        }
        const idolCode = fileName.replace(/\.png$/i, '')
        const filePath = path.resolve(
          CHARACTER_IMAGE_CANDIDATE_ROOT,
          kind,
          idolCode,
          'resolved',
          fileName,
        )
        if (
          !filePath.startsWith(CHARACTER_IMAGE_CANDIDATE_ROOT + path.sep) ||
          !fs.existsSync(filePath)
        ) {
          next()
          return
        }
        res.setHeader('Content-Type', 'image/png')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(filePath).pipe(res)
      })

      server.middlewares.use('/data/character-candidate', (req, res, next) => {
        const rawUrl = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const [kind, fileName, ...rest] = rawUrl.split('/')
        if (
          rest.length ||
          !CHARACTER_IMAGE_CANDIDATE_KINDS.has(kind) ||
          !/^\d{3}[a-z0-9]{3}\.json$/i.test(fileName || '')
        ) {
          next()
          return
        }
        const idolCode = fileName.replace(/\.json$/i, '')
        const filePath = path.resolve(
          CHARACTER_IMAGE_CANDIDATE_ROOT,
          kind,
          idolCode,
          'candidate.json',
        )
        if (
          !filePath.startsWith(CHARACTER_IMAGE_CANDIDATE_ROOT + path.sep) ||
          !fs.existsSync(filePath)
        ) {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(filePath).pipe(res)
      })
    },
  }
}

function rawAudioCandidatePlugin() {
  return {
    name: 'sidem-raw-audio-candidate',
    configureServer(server) {
      server.middlewares.use('/assets/audio-candidate', (req, res, next) => {
        const rawUrl = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const parts = rawUrl.split('/')
        const [kind, cueOrFile, segmentDir, segmentFile, ...rest] = parts
        const isComposite =
          parts.length === 2 && /^[a-z0-9_]+\.m4a$/i.test(cueOrFile || '')
        const isSegment =
          parts.length === 4 &&
          /^[a-z0-9_]+$/i.test(cueOrFile || '') &&
          segmentDir === 'segments' &&
          /^\d{2}_selection_\d+\.m4a$/i.test(segmentFile || '')
        if (
          rest.length ||
          !['song', 'bgm', 'ambient', 'se'].includes(kind) ||
          (!isComposite && !isSegment)
        ) {
          next()
          return
        }
        const cue = isComposite ? cueOrFile.replace(/\.m4a$/i, '') : cueOrFile
        const filePath = isComposite
          ? path.resolve(AUDIO_CANDIDATE_ROOT, kind, cue, cueOrFile)
          : path.resolve(AUDIO_CANDIDATE_ROOT, kind, cue, segmentDir, segmentFile)
        if (
          !filePath.startsWith(AUDIO_CANDIDATE_ROOT + path.sep) ||
          !fs.existsSync(filePath)
        ) {
          next()
          return
        }
        res.setHeader('Content-Type', 'audio/mp4')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(filePath).pipe(res)
      })

      server.middlewares.use('/data/audio-candidate', (req, res, next) => {
        const rawUrl = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const [kind, fileName, ...rest] = rawUrl.split('/')
        if (
          rest.length ||
          !['song', 'bgm', 'ambient', 'se'].includes(kind) ||
          !/^[a-z0-9_]+\.json$/i.test(fileName || '')
        ) {
          next()
          return
        }
        const cue = fileName.replace(/\.json$/i, '')
        const filePath = path.resolve(AUDIO_CANDIDATE_ROOT, kind, cue, 'candidate.json')
        if (
          !filePath.startsWith(AUDIO_CANDIDATE_ROOT + path.sep) ||
          !fs.existsSync(filePath)
        ) {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(filePath).pipe(res)
      })
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    lipsyncStaticPlugin(),
    audioPlugin(),
    cardArtPlugin(),
    rawStoryCandidatePlugin(),
    rawCardCandidatePlugin(),
    rawBackgroundCandidatePlugin(),
    rawCharacterImageCandidatePlugin(),
    rawAudioCandidatePlugin(),
  ],
  optimizeDeps: {
    noDiscovery: true,
    include: ['@pixi/utils'],
  },
  server: {
    port: 5173,
    // Ignore massive asset directories from file watcher.
    // The 32K+ voice files and 700+ spine models cause chokidar
    // to hang the dev server on Windows.
    watch: {
      ignored: [
        '**/public/assets/voice/**',
        '**/public/assets/spines/**',
        '**/public/assets/bg/**',
        '**/public/assets/lipsync/**',
        '**/.analysis/**',
      ],
    },
  },
})
