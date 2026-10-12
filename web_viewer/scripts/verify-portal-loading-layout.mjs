// Portal overview holds its layout while loading: the four footprint slots and one tile per bootstrap unit render
// before the overview data arrives, and the loading notice is announced without taking space. Without these the
// counts and the unit grid arrived late and pushed the page down (mobile CLS 0.68, desktop 0.37; see
// docs/GS_ARCHIVE_PORTAL_SSG_EXPERIMENT_20261013.md). Real SFC SSR render.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

const bootstrap = JSON.parse(readFileSync(new URL('../readmodels/bootstrap.inline.json', import.meta.url), 'utf8'))
const unitCount = new Set(bootstrap.idols.map(idol => idol.unitCode).filter(Boolean)).size
const server = await createServer({ configFile: false, plugins: [vue()], optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, watch: null }, appType: 'custom' })
const count = (html, pattern) => (html.match(pattern) || []).length
// Scoped styles add data-v-* attributes; drop them so assertions read like the template.
const plain = html => html.replace(/ data-v-[0-9a-f]+/g, '')
try {
  const { default: Overview } = await server.ssrLoadModule('/src/components/archive/ArchivePortalOverview.vue')
  const render = async props => plain(await renderToString(createSSRApp({ render: () => h(Overview, { idols: bootstrap.idols, ...props }) })))

  const loading = await render({ desktopOverview: { loading: true } })
  assert.match(loading, /<p class="overview-footprint"[^>]*aria-busy="true"/, 'the footprint line is present while loading')
  assert.equal(count(loading, /<button[^>]*disabled[^>]*title="[^"]*"/g) >= 4, true, 'four disabled footprint slots')
  for (const label of ['卡片', '歌曲', '可读故事', '活动记录']) assert.ok(loading.includes(`<span>${label}</span>`), `footprint slot ${label}`)
  assert.equal(count(loading, /overview-unit-tile is-placeholder/g), unitCount, `one placeholder tile per unit (${unitCount})`)
  assert.ok(loading.includes(`${unitCount} 个组合`), 'the unit count shows while loading')
  assert.match(loading, /class="overview-status overview-visually-hidden" role="status">正在读取门户资料…/, 'the loading notice is announced, not laid out')

  const failed = await render({ desktopOverview: { loading: false, error: '读取失败' } })
  assert.equal(count(failed, /is-placeholder/g), 0, 'no placeholder grid over an error')

  const units = [{ id: '01jup', title: 'Jupiter', color: '#f00', members: [] }]
  const loaded = await render({ desktopOverview: { loading: false, units, footprints: [{ id: 'cards', label: '卡片', value: 826, total: 826 }] } })
  assert.equal(count(loaded, /is-placeholder/g), 0, 'placeholders leave once units arrive')
  assert.match(loaded, /aria-busy="false"/)
  assert.ok(loaded.includes('826'), 'real counts replace the slots')

  const preferred = await render({ desktopOverview: { loading: true }, preferredReference: { actionable: true, idolCode: '001tom' } })
  for (const label of ['相关歌曲', '出场故事', '活动足迹']) assert.ok(preferred.includes(`<span>${label}</span>`), `idol-scope slot ${label}`)
  assert.equal(count(preferred, /overview-unit-hub/g), 0, 'the unit hub stays hidden for an idol scope')
} finally {
  await server.close()
}
console.log(`Portal loading layout: 4 footprint slots, ${unitCount} unit placeholders and an announced-only notice while loading; none over errors or after data`)
