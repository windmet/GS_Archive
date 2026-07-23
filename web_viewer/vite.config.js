import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'

const LIPSYNC_ROOT = process.env.SIDEM_LIPSYNC_ROOT || 'E:/BaiduNetdiskDownload/SideM/scripts/lipsyncdata/adxlip'
const AUDIO_ROOT = process.env.SIDEM_AUDIO_ROOT || 'E:/BaiduNetdiskDownload/SideM/GS_Res/Audio'
const LEGACY_AUDIO_ROOT = process.env.SIDEM_LEGACY_AUDIO_ROOT || 'E:/BaiduNetdiskDownload/SideM/story_viewer/voice_ogg'
const CARD_ART_ROOT = process.env.SIDEM_CARD_ART_ROOT || 'E:/BaiduNetdiskDownload/SideM/GS_Res/ALL_PHOTOS/assets/resources/image/image_card'

function addSeAliasCandidates(candidates, fileName) {
  if (!fileName.endsWith('.ogg')) return
  const cue = fileName.replace(/\.ogg$/, '')
  const aliases = []

  if (/^step_(walk|run)_(come|away)_conc_sneaker$/.test(cue)) {
    aliases.push(cue.replace(/^step_(walk|run)_(come|away)_conc_sneaker$/, 'group_step_$1_conc_sneaker'))
  }
  if (cue === 'step_walk_come_conc_boot' || cue === 'step_walk_away_conc_boot') {
    aliases.push('step_walk_come_conc_boot_hall', 'step_walk_come_conc_boot_slow')
  }

  for (const alias of aliases) {
    for (const dir of ['sfx', 'telephone', 'system']) {
      candidates.push(path.resolve(AUDIO_ROOT, dir, `${alias}.ogg`))
    }
    candidates.push(path.resolve(LEGACY_AUDIO_ROOT, `${alias}.ogg`))
  }
}

function lipsyncStaticPlugin() {
  return {
    name: 'sidem-lipsync-static',
    configureServer(server) {
      server.middlewares.use('/assets/lipsync/adxlip', (req, res, next) => {
        const rawUrl = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const filePath = path.resolve(LIPSYNC_ROOT, rawUrl)
        const rootPath = path.resolve(LIPSYNC_ROOT)
        if (!filePath.startsWith(rootPath + path.sep)) {
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
 * resolves it to the correct subdirectory under AUDIO_ROOT.
 *
 * SE cues can be in sfx/, telephone/, or system/ — the middleware tries each.
 * Ambient cues with _t suffix try both with and without the suffix.
 */
function audioPlugin() {
  const AUDIO_DIRS = ['ambient', 'bgm', 'sfx', 'system', 'telephone']
  return {
    name: 'sidem-audio',
    configureServer(server) {
      server.middlewares.use('/assets/audio', (req, res, next) => {
        const rawUrl = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        // rawUrl will be like: "se/cloth_move_ss01.ogg" or "ambient/ambi_room.ogg"
        const parts = rawUrl.split('/')
        const type = parts[0]      // se, ambient, bgm, system, telephone
        const fileName = parts.slice(1).join('/')  // "cloth_move_ss01.ogg"

        if (!type || !fileName) { next(); return }

        const candidates = []
        if (type === 'se') {
          // SE can be in sfx/, telephone/, or system/
          for (const dir of ['sfx', 'telephone', 'system']) {
            candidates.push(path.resolve(AUDIO_ROOT, dir, fileName))
          }
          candidates.push(path.resolve(LEGACY_AUDIO_ROOT, fileName))
          addSeAliasCandidates(candidates, fileName)
        } else if (AUDIO_DIRS.includes(type)) {
          candidates.push(path.resolve(AUDIO_ROOT, type, fileName))
          // Ambient: also try without _t suffix
          if (type === 'ambient' && fileName.endsWith('_t.ogg')) {
            candidates.push(path.resolve(AUDIO_ROOT, type, fileName.replace(/_t\.ogg$/, '.ogg')))
          }
        } else {
          next(); return
        }

        const rootPaths = [path.resolve(AUDIO_ROOT), path.resolve(LEGACY_AUDIO_ROOT)]
        for (const fp of candidates) {
          if (!rootPaths.some(rootPath => fp.startsWith(rootPath + path.sep))) continue
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
  const directories = {
    portrait: 'image_card_portrait',
    landscape: 'image_card_landscape',
  }
  return {
    name: 'sidem-card-art',
    configureServer(server) {
      server.middlewares.use('/assets/card-art', (req, res, next) => {
        const rawUrl = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const [kind, ...nameParts] = rawUrl.split('/')
        const directory = directories[kind]
        const fileName = nameParts.join('/')
        if (!directory || !/^image_card_(portrait|landscape)_[a-z0-9_]+\.png$/i.test(fileName)) {
          next()
          return
        }
        const rootPath = path.resolve(CARD_ART_ROOT)
        const filePath = path.resolve(rootPath, directory, fileName)
        if (!filePath.startsWith(rootPath + path.sep) || !fs.existsSync(filePath)) {
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

export default defineConfig({
  plugins: [vue(), lipsyncStaticPlugin(), audioPlugin(), cardArtPlugin()],
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
      ],
    },
  },
})
