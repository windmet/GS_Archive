<template>
  <div id="story-viewer">

    <!-- ====== HOME ====== -->
    <div v-if="view === 'home'" class="screen home-screen">
      <h1 class="app-title">SideM Story Viewer</h1>
      <p class="app-subtitle">{{ totalFiles }} scenarios</p>
      <div class="category-grid">
        <button
          v-for="cat in CATEGORIES"
          :key="cat.id"
          class="cat-btn"
          @click="openCategory(cat)"
        >
          <span class="cat-label">{{ cat.name }}</span>
          <span class="cat-count">{{ catCountText(cat.id) }}</span>
        </button>
        <!-- Spine Lab entry -->
        <button class="cat-btn lab-btn" @click="view = 'spine_lab'">
          <span class="cat-label">🧪 Spine 实验室</span>
          <span class="cat-count">自由预览</span>
        </button>
      </div>
    </div>

    <!-- ====== IDOL CHARACTER GRID ====== -->
    <div v-if="view === 'idols'" class="screen list-screen">
      <div class="list-header">
        <button class="back-btn" @click="view = 'home'">← Back</button>
        <h2>{{ categoryHeaderText }}</h2>
      </div>
      <div class="filter-bar">
        <input v-model="filterQuery" :placeholder="categoryFilterPlaceholder" class="filter-input" />
      </div>
      <div class="idol-grid">
        <button
          v-for="entry in filteredIdols"
          :key="entry.id"
          class="idol-card"
          :class="{ 'group-card': entry._isGroup }"
          @click="openIdol(entry)"
        >
          <img
            v-if="!entry._isGroup"
            :src="`/assets/idols/icons/image_chara_icon_${entry.id}.png`"
            :alt="entry.name"
            class="idol-avatar"
            loading="lazy"
          />
          <div v-else class="group-avatar"></div>
          <span class="idol-name">{{ entry.name }}</span>
        </button>
      </div>
    </div>

    <!-- ====== GROUP LIST (idol character or generic category) ====== -->
    <div v-if="view === 'groups'" class="screen list-screen">
      <div class="list-header">
        <button class="back-btn" @click="goBackFromGroups">← Back</button>
        <h2>{{ groupTitle }}</h2>
      </div>
      <div class="filter-bar">
        <input v-model="filterQuery" placeholder="Search group..." class="filter-input" />
      </div>
      <div class="group-list">
        <button
          v-for="g in filteredGroups"
          :key="g.id"
          class="group-card"
          :class="{ 'group-card-event': g.event_meta }"
          @click="openGroup(g)"
        >
          <!-- Event display with logo -->
          <template v-if="g.event_meta">
            <div class="event-img-wrap">
              <img
                :src="g.event_meta.logo"
                :alt="g.event_meta.title"
                class="event-logo"
                loading="lazy"
              />
            </div>
            <div class="event-info">
              <span class="event-series">{{ g.event_meta.series }}</span>
              <span class="event-title">{{ g.event_meta.title }}</span>
              <span v-if="g.event_meta.catchphrase" class="event-catchphrase">{{ g.event_meta.catchphrase }}</span>
            </div>
          </template>
          <!-- Default group display -->
          <template v-else>
            <span class="group-title">{{ g.title }}</span>
            <span class="group-meta">{{ g.files.length }} files</span>
          </template>
        </button>
      </div>
    </div>

    <!-- ====== EPISODE ZERO: UNIT GRID ====== -->
    <div v-if="view === 'episode_zero_units'" class="screen list-screen">
      <div class="list-header">
        <button class="back-btn" @click="view = 'home'">← Back</button>
        <h2>第零话</h2>
      </div>
      <div class="unit-grid">
        <button
          v-for="unit in episodeZeroUnits"
          :key="unit.unit_code"
          class="unit-card"
          @click="openUnit(unit)"
        >
          <span class="unit-name">{{ unit.unit_name }}</span>
          <span class="unit-count">{{ unit.episodes.length }} episodes</span>
        </button>
      </div>
    </div>

    <!-- ====== EPISODE ZERO: EPISODE LIST ====== -->
    <div v-if="view === 'episodes'" class="screen list-screen">
      <div class="list-header">
        <button class="back-btn" @click="view = 'episode_zero_units'">← Back</button>
        <h2>{{ currentUnit?.unit_name || 'Episodes' }}</h2>
      </div>
      <div class="episode-list">
        <button
          v-for="ep in currentUnit?.episodes"
          :key="ep.id"
          class="episode-btn"
          @click="openEpisodeFiles(ep)"
        >
          <span class="episode-title">{{ ep.title || ep.id }}</span>
          <span class="episode-count">{{ ep.files.length }} files</span>
        </button>
      </div>
    </div>

    <!-- ====== SCENARIO FILE LIST ====== -->
    <div v-if="view === 'files'" class="screen list-screen">
      <div class="list-header">
        <button class="back-btn" @click="goBackToFiles">← Back</button>
        <h2>{{ currentGroup?.title || 'Scenarios' }}</h2>
      </div>
      <div class="filter-bar">
        <input v-model="filterQuery" placeholder="Search scenario..." class="filter-input" />
      </div>
      <div class="file-list">
        <button
          v-for="fn in filteredFiles"
          :key="fn"
          class="file-btn"
          @click="loadScenario(fn)"
        >
          {{ formatFileName(fn) }}
        </button>
      </div>
    </div>

    <!-- ====== STORY PLAYER ====== -->
    <StoryViewer
      v-if="view === 'player' && currentScenario"
      :scenario-json="currentScenario"
      @back="closePlayer"
      @ready="onPlayerReady"
    />

    <!-- ====== SPINE LAB ====== -->
    <SpineViewer v-if="view === 'spine_lab'" @back="view = 'home'" />

    <!-- ====== PRELOADER LOADING SCREEN ====== -->
    <LoadingScreen :visible="loading" :progress="preloadProgress" />

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import StoryViewer from './core/StoryViewer.vue'
import SpineViewer from './components/SpineViewer.vue'
import { IDOL_ID_TO_NAME } from './utils/IdolNameMap.js'
import { Preloader } from './utils/Preloader.js'
import LoadingScreen from './components/LoadingScreen.vue'

function resolveChatName(ch) {
  // index may store raw chara_id "031sak" as name — resolve to display name
  if (ch && /^\d{3}[a-z0-9]{3}$/.test(ch.name || '')) {
    return { ...ch, name: IDOL_ID_TO_NAME[ch.name] || ch.name }
  }
  return ch
}

const view = ref('home')
const indexData = ref(null)
const currentScenario = ref(null)
const filterQuery = ref('')
const loading = ref(false)
const preloadProgress = ref(0)

// Navigation context
const currentCategoryId = ref('')
const currentCharacterId = ref('')
const currentGroup = ref(null)
const currentUnit = ref(null)

const CATEGORIES = [
  { id: 'main_story', name: '主线剧情' },
  { id: 'event', name: '活动剧情' },
  { id: 'idol', name: '偶像个人' },
  { id: 'idol_chat', name: '短信聊天' },
  { id: 'idol_phone', name: '电话聊天' },
  { id: 'episode_zero', name: '第零话' },
  { id: 'extra', name: '额外剧情' },
]

const totalFiles = computed(() => {
  if (!indexData.value) return 0
  let sum = 0
  for (const cat of indexData.value.categories) {
    if (cat.groups) sum += cat.groups.reduce((s, g) => s + g.files.length, 0)
    if (cat.characters) {
      for (const ch of Object.values(cat.characters)) {
        sum += ch.groups.reduce((s, g) => s + g.files.length, 0)
      }
    }
    if (cat.individual) {
      for (const ch of Object.values(cat.individual)) {
        sum += ch.groups.reduce((s, g) => s + g.files.length, 0)
      }
    }
    if (cat.units) {
      for (const u of cat.units) {
        for (const ep of u.episodes) {
          sum += ep.files.length
        }
      }
    }
  }
  return sum
})

function categoryById(id) {
  if (!indexData.value) return null
  return indexData.value.categories.find(c => c.id === id) || null
}

const currentCategory = computed(() => categoryById(currentCategoryId.value))

function catCountText(id) {
  const cat = categoryById(id)
  if (!cat) return ''
  if (cat.id === 'idol' && cat.characters) return `${Object.keys(cat.characters).length} idols`
  if (cat.id === 'idol_chat') {
    const n = Object.keys(cat.individual || {}).length
    const g = (cat.groups || []).length
    return `${n + g} chats`
  }
  if (cat.id === 'idol_phone') {
    return `${Object.keys(cat.individual || {}).length} calls`
  }
  if (cat.units) return `${cat.units.length} units`
  if (cat.groups) {
    const c = cat.groups.reduce((s, g) => s + g.files.length, 0)
    return `${c} files`
  }
  return ''
}

// — Idol / Chat grid —
const idolList = computed(() => {
  const catId = currentCategoryId.value
  if (catId === 'idol_phone') {
    const cat = categoryById('idol_phone')
    const source = cat?.individual
    if (!source) return []
    return Object.entries(source).map(([id, data]) => ({ id, ...resolveChatName(data), _isGroup: false }))
  }
  const cat = categoryById(catId === 'idol_chat' ? 'idol_chat' : 'idol')
  const source = catId === 'idol_chat' ? cat?.individual : cat?.characters
  if (!source) return []
  // For chat category, also include group chat entries
  if (catId === 'idol_chat' && cat?.groups) {
    const chars = Object.entries(source).map(([id, data]) => ({ id, ...resolveChatName(data), _isGroup: false }))
    const groups = cat.groups.map(g => ({ id: g.unit_code, name: g.unit_name, _isGroup: true, _groupData: g }))
    return [...groups, ...chars]
  }
  return Object.entries(source).map(([id, data]) => ({ id, ...data }))
})

const filteredIdols = computed(() => {
  const q = filterQuery.value.toLowerCase()
  if (!q) return idolList.value
  return idolList.value.filter(ch => ch.name.toLowerCase().includes(q))
})

// — Group list —
const filteredGroups = computed(() => {
  if (!currentCharacterId.value && !currentCategoryId.value) return []
  let groups = []

  if (currentCharacterId.value) {
    if (currentCategoryId.value === 'idol_chat') {
      const cat = categoryById('idol_chat')
      const ch = cat?.individual?.[currentCharacterId.value]
      groups = ch?.groups || []
    } else if (currentCategoryId.value === 'idol_phone') {
      const cat = categoryById('idol_phone')
      const ch = cat?.individual?.[currentCharacterId.value]
      groups = ch?.groups || []
    } else {
      const cat = categoryById('idol')
      const ch = cat?.characters?.[currentCharacterId.value]
      groups = ch?.groups || []
    }
  } else if (currentCategoryId.value) {
    const cat = categoryById(currentCategoryId.value)
    groups = cat?.groups || []
  }

  const q = filterQuery.value.toLowerCase()
  if (!q) return groups
  return groups.filter(g =>
    g.title.toLowerCase().includes(q) ||
    g.id.toLowerCase().includes(q)
  )
})

const groupTitle = computed(() => {
  if (currentCharacterId.value) {
    if (currentCategoryId.value === 'idol_chat') {
      const cat = categoryById('idol_chat')
      const ch = resolveChatName(cat?.individual?.[currentCharacterId.value])
      return ch?.name || currentCharacterId.value
    }
    if (currentCategoryId.value === 'idol_phone') {
      const cat = categoryById('idol_phone')
      const ch = resolveChatName(cat?.individual?.[currentCharacterId.value])
      return ch?.name || currentCharacterId.value
    }
    const cat = categoryById('idol')
    const ch = cat?.characters?.[currentCharacterId.value]
    return ch?.name || currentCharacterId.value
  }
  return currentCategory.value?.name || ''
})

const categoryHeaderText = computed(() => {
  if (currentCategoryId.value === 'idol_chat') return '短信聊天'
  if (currentCategoryId.value === 'idol_phone') return '电话聊天'
  return '偶像个人'
})

const categoryFilterPlaceholder = computed(() => {
  if (currentCategoryId.value === 'idol_chat') return 'Search chat...'
  if (currentCategoryId.value === 'idol_phone') return 'Search phone...'
  return 'Search idol...'
})

// — Episode Zero units —
const episodeZeroUnits = computed(() => {
  const cat = categoryById('episode_zero')
  return cat?.units || []
})

// — File list —
const filteredFiles = computed(() => {
  if (!currentGroup.value) return []
  const files = currentGroup.value.files
  const q = filterQuery.value.toLowerCase()
  if (!q) return files
  return files.filter(fn => fn.toLowerCase().includes(q))
})

// — Navigation —
function openCategory(cat) {
  filterQuery.value = ''
  if (cat.id === 'idol' || cat.id === 'idol_chat' || cat.id === 'idol_phone') {
    currentCategoryId.value = cat.id
    currentCharacterId.value = ''
    currentGroup.value = null
    view.value = 'idols'
  } else if (cat.id === 'episode_zero') {
    currentCategoryId.value = 'episode_zero'
    view.value = 'episode_zero_units'
  } else {
    currentCategoryId.value = cat.id
    currentCharacterId.value = ''
    currentGroup.value = null
    view.value = 'groups'
  }
}

function openIdol(entry) {
  filterQuery.value = ''
  // Group chat entry in idol_chat grid — go directly to file view (1 session per unit)
  if (entry._isGroup && entry._groupData) {
    currentCharacterId.value = entry.id
    currentCategoryId.value = 'idol_chat'
    currentGroup.value = entry._groupData.groups[0]
    view.value = 'files'
    return
  }
  currentCharacterId.value = entry.id
  currentCategoryId.value = currentCategoryId.value || 'idol'
  currentGroup.value = null
  view.value = 'groups'
}

function openGroup(group) {
  currentGroup.value = group
  filterQuery.value = ''
  view.value = 'files'
}

function openUnit(unit) {
  currentUnit.value = unit
  filterQuery.value = ''
  view.value = 'episodes'
}

function openEpisodeFiles(ep) {
  // Create a synthetic group object from episode data
  currentGroup.value = { id: ep.id, title: ep.title, files: ep.files }
  filterQuery.value = ''
  view.value = 'files'
}

function goBackFromGroups() {
  if (currentCharacterId.value) {
    view.value = 'idols'
  } else {
    view.value = 'home'
  }
}

function goBackToFiles() {
  if (currentUnit.value) {
    view.value = 'episodes'
  } else if (currentCharacterId.value && (currentCategoryId.value === 'idol_chat' || currentCategoryId.value === 'idol_phone')) {
    view.value = 'idols'
  } else if (currentCharacterId.value) {
    view.value = 'groups'
  } else {
    view.value = 'groups'
  }
}

function closePlayer() {
  currentScenario.value = null
  view.value = 'files'
}

function onPlayerReady() {
  loading.value = false
}

function formatFileName(fn) {
  return fn.replace(/\.json$/, '').replace(/^[^_]+_[^_]+_scenario_/, '')
}

async function loadScenario(name) {
  loading.value = true
  preloadProgress.value = 0
  try {
    const r = await fetch(`/data/compiled/${name}`)
    const scenario = await r.json()

    // Preload all scenario assets before switching to player
    await Preloader.preloadScenario(scenario.steps || [], (pct) => {
      preloadProgress.value = pct
    })

    currentScenario.value = scenario
    view.value = 'player'
    loading.value = false
  } catch (err) {
    console.error('Failed to load:', err)
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const r = await fetch('/data/compiled/index.json')
    indexData.value = await r.json()
  } catch (err) {
    console.error('Failed to load index:', err)
  }

  // ── 全局调试：showAnims('001tom') 在 Console 打印角色所有动作 ──
  window.showAnims = async (charaId, modelIdx) => {
    const KNOWN_MODELS = [
      '001tom_002_00','001tom_003_00','001tom_004_00','001tom_004_01','001tom_005_00','001tom_101_00','001tom_101_01','001tom_102_00','001tom_103_00','001tom_103_01',
      '002dra_002_00','002dra_003_00','003min_002_00','003min_003_00','004ren_002_00','004ren_003_00','005sho_002_00','005sho_003_00',
      '006aio_002_00','006aio_003_00','007you_002_00','007you_003_00',
      '008ter_002_00','008ter_003_00','009ryu_002_00','009ryu_003_00',
      '010kai_002_00','010kai_003_00',
      '024kir_002_00','024kir_003_00','025suz_002_00','025suz_003_00',
      '031sak_002_00','031sak_003_00','032nco_002_00','032nco_003_00',
    ]
    const models = KNOWN_MODELS.filter(m => m.startsWith(charaId))
    if (models.length === 0) {
      const ids = [...new Set(KNOWN_MODELS.map(m => m.split('_')[0]))].sort()
      console.warn(`Unknown charaId "${charaId}". Try: ${ids.join(', ')}`)
      return
    }
    const targets = modelIdx !== undefined ? [models[modelIdx]] : models
    for (const modelId of targets) {
      try {
        const atlasUrl = `/assets/spines/${modelId}/comu.atlas`
        const skelUrl = `/assets/spines/${modelId}/comu.skel`
        const [atlasR, skelR] = await Promise.all([fetch(atlasUrl), fetch(skelUrl)])
        if (!atlasR.ok || !skelR.ok) { console.warn(`[${modelId}] files not found`); continue }
        const [atlasBuf, skelBuf] = await Promise.all([atlasR.arrayBuffer(), skelR.arrayBuffer()])
        // Decode atlas — same logic as PixiStageManager._decodeAtlasText
        const fullText = new TextDecoder('utf-8').decode(atlasBuf)
        const si = fullText.indexOf('\nsize:')
        let atlasText = fullText
        if (si >= 0) {
          const ls = fullText.lastIndexOf('\n', si - 1)
          if (ls >= 0) {
            const c = fullText.substring(ls + 1)
            if (c.split('\n')[0].trim() && !c.includes(':')) atlasText = c
          }
        }
        // Dynamically load PIXI + spine
        const PIXI = await import('pixi.js')
        const { SkeletonBinary, AtlasAttachmentLoader } = await import('@pixi-spine/runtime-3.8')
        const { TextureAtlas } = await import('@pixi-spine/base')
        // Extract texture filename from atlas (same as PixiStageManager._extractTextureFilename)
        const texFileName = (() => {
          for (const line of atlasText.split('\n')) {
            const t = line.trim()
            if (t && !t.includes(':') && !t.startsWith('//')) return t.split('/').pop()
          }
          return 'comu.png'
        })()
        // Load texture using Image() approach (same as PixiStageManager._loadTextureFromUrl)
        const baseUrl = `/assets/spines/${modelId}`
        const texUrl = `${baseUrl}/${texFileName}`
        const texture = await new Promise((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            const bt = PIXI.BaseTexture.from(img)
            bt.alphaMode = PIXI.ALPHA_MODES.PMA
            const done = () => resolve(PIXI.Texture.from(bt))
            if (bt.valid) done()
            else { bt.once('update', done); setTimeout(() => { bt.valid ? true : done() }, 5000) }
          }
          img.onerror = () => reject(new Error('texture load failed'))
          img.src = texUrl
        })
        texture.baseTexture.alphaMode = PIXI.ALPHA_MODES.PMA
        const texMap = {}; texMap[texFileName] = texture
        // Create fallback texture (magenta 64x64, same as PixiStageManager._getFallbackTexture)
        const fbCanvas = document.createElement('canvas'); fbCanvas.width = 64; fbCanvas.height = 64
        const fbCtx = fbCanvas.getContext('2d'); fbCtx.fillStyle = '#ff00ff'; fbCtx.fillRect(0, 0, 64, 64)
        const fbBT = PIXI.BaseTexture.from(fbCanvas); fbBT.alphaMode = PIXI.ALPHA_MODES.PMA
        const atlas = await new Promise((rs, rj) => {
          new TextureAtlas(atlasText, (p, cb) => {
            cb(texMap[p.split('/').pop()]?.baseTexture || fbBT)
          }, r => r ? rs(r) : rj(new Error('atlas fail')))
        })
        atlas.pages.forEach(p => p.pma = true)
        const sd = new SkeletonBinary(new AtlasAttachmentLoader(atlas)).readSkeletonData(new Uint8Array(skelBuf))
        const anims = sd.animations.map(a => a.name)
        console.log(`%c▼ ${modelId} — ${anims.length} animations • ${sd.bones.length} bones`, 'font-weight:bold;color:#88ddff;font-size:14px')
        console.log(anims.map((a, i) => `  ${String(i+1).padStart(2,'0')}. ${a}`).join('\n'))
      } catch (e) { console.warn(`[${modelId}] load failed:`, e?.message || e) }
    }
  }
  console.log('%c💡 Console: showAnims("001tom") — list all animations', 'color:#88ddff;font-size:12px')
})
</script>

<style scoped>
#story-viewer {
  width: 100%; height: 100vh; color: #222;
  background: #f8f9fa; overflow: hidden;
}
/* Ensure no horizontal scroll at the app level */
#story-viewer .screen { overflow-x: hidden; }

/* Home */
.home-screen {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 100%; padding: 40px 20px;
}
.app-title { font-size: 1.6rem; margin-bottom: 4px; color: #111; }
.app-subtitle { color: #888; font-size: 0.85rem; margin-bottom: 40px; }

.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px; max-width: 560px; width: 100%;
}
.cat-btn {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: #fff; border: 1px solid #e0e0e0;
  border-radius: 12px; padding: 28px 12px; cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.cat-btn:hover { background: #f0f4ff; border-color: #88ccff; box-shadow: 0 2px 8px rgba(136,204,255,0.2); }
.cat-label { font-size: 1rem; font-weight: bold; color: #333; }
.cat-count { font-size: 0.7rem; color: #999; }

/* Shared list screens */
.list-screen { padding: 0; height: 100%; overflow-y: auto; overflow-x: hidden; }
.list-header {
  position: sticky; top: 0; z-index: 5;
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; background: #fff; border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.list-header h2 { margin: 0; font-size: 1rem; flex: 1; color: #222; }
.back-btn {
  background: transparent; color: #4488cc; border: 1px solid #c0d8ee;
  border-radius: 6px; padding: 4px 12px; cursor: pointer; font-size: 0.85rem;
}
.back-btn:hover { background: #e8f0ff; }

.filter-bar {
  position: sticky; top: 48px; z-index: 5;
  padding: 8px 16px; background: #f8f9fa;
}
.filter-input {
  width: 100%; padding: 8px 12px;
  background: #fff; border: 1px solid #ccc; color: #222;
  border-radius: 6px; font-size: 0.85rem;
}
.filter-input:focus { outline: none; border-color: #88ccff; box-shadow: 0 0 0 2px rgba(136,204,255,0.2); }

/* —— Idol Grid with Avatars —— */
.idol-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px; padding: 16px;
}
.idol-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: #fff; border: 1px solid #e8e8e8;
  border-radius: 12px; padding: 16px 8px 12px; cursor: pointer;
  transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.idol-card:hover { background: #f0f4ff; border-color: #88ccff55; transform: translateY(-2px); box-shadow: 0 3px 10px rgba(0,0,0,0.08); }
.idol-avatar {
  width: 56px; height: 56px; border-radius: 50%;
  object-fit: cover; background: #eee;
}
.idol-name { font-size: 0.78rem; color: #444; text-align: center; line-height: 1.2; }

.group-card { border-color: #b3d9ff; background: #f5faff; }

/* —— Group List —— */
.group-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px; padding: 12px 16px;
}
.group-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  width: 100%; text-align: center;
  background: #fff; border: 1px solid #e8e8e8;
  border-radius: 10px; padding: 12px; cursor: pointer;
  color: #444; transition: background 0.15s, box-shadow 0.15s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.group-card:hover { background: #f5f7fa; color: #222; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }

/* Default group (non-event) */
.group-title { display: block; font-size: 0.85rem; color: #333; line-height: 1.3; }
.group-meta { font-size: 0.7rem; color: #999; margin-top: auto; }

/* Event-specific display — fixed-height image + uniform card */
.group-card-event { align-items: stretch; padding: 0; overflow: hidden; }
.group-card-event .event-img-wrap {
  width: 100%; height: 140px; display: flex; align-items: center; justify-content: center;
  background: #f0f2f5; overflow: hidden;
}
.event-logo {
  width: 100%; height: 100%; object-fit: contain; display: block;
  background: #f0f2f5;
}
.event-info { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px 10px; flex: 1; }
.event-series { font-size: 0.65rem; color: #b8860b; text-transform: uppercase; font-weight: 600; }
.event-title { font-size: 0.82rem; color: #111; font-weight: bold; line-height: 1.3; }
.event-catchphrase { font-size: 0.7rem; color: #777; font-style: italic; line-height: 1.2; }

/* —— Episode Zero Unit Grid —— */
.unit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px; padding: 16px;
}
.unit-card {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: #fff; border: 1px solid #e8e8e8;
  border-radius: 12px; padding: 20px 10px; cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.unit-card:hover { background: #f0f4ff; border-color: #88ccff55; }
.unit-name { font-size: 0.85rem; font-weight: bold; color: #333; text-align: center; }
.unit-count { font-size: 0.7rem; color: #999; }

/* —— Episode List —— */
.episode-list { padding: 8px 16px 16px; }
.episode-btn {
  display: block; width: 100%; text-align: left;
  background: #fff; border: 1px solid #e8e8e8;
  border-radius: 8px; padding: 12px 16px; margin-bottom: 6px; cursor: pointer;
  color: #444; transition: background 0.15s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
.episode-btn:hover { background: #f5f7fa; color: #222; }
.episode-title { display: block; font-size: 0.9rem; margin-bottom: 2px; color: #333; }
.episode-count { font-size: 0.7rem; color: #999; }

/* —— File List —— */
.file-list { padding: 8px 16px 16px; }
.file-btn {
  display: block; width: 100%; text-align: left;
  background: #fff; border: 1px solid #eee;
  border-radius: 6px; padding: 8px 12px; margin-bottom: 4px; cursor: pointer;
  color: #666; font-size: 0.78rem; font-family: monospace;
  transition: background 0.15s;
}
.file-btn:hover { background: #f0f4ff; color: #222; }

/* —— Loading Overlay —— */
.loading-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: #fff; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
}
.loading-box {
  display: flex; flex-direction: column; align-items: center; gap: 16px;
}
.loading-spinner {
  width: 36px; height: 36px;
  border: 3px solid #e0e0e0; border-top-color: #4488cc;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { color: #888; font-size: 0.9rem; }
</style>

<style>
/* Global reset — no page-level scrollbar */
html, body { margin: 0; padding: 0; height: 100%; overflow-x: hidden; overflow-y: hidden; }
*, *::before, *::after { box-sizing: border-box; }
#app { overflow-x: hidden; }
</style>
