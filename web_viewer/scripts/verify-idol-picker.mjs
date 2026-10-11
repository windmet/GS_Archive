import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'

// The one idol picker (onboarding, settings, home / communication picker) and the surfaces that
// used to borrow the retired terminal stylesheet. Names go through the caller's display callback;
// every surface owns its own styles instead of relying on a sheet some other page loaded first.
const root = fileURLToPath(new URL('..', import.meta.url))
const read = file => readFileSync(path.join(root, file), 'utf8')

const idols = [
  { id: '001tom', name: '天ヶ瀬 冬馬', kana: 'あまがせ とうま', unitCode: '01jup', unitName: 'Jupiter', color: '#f32836' },
  { id: '002sho', name: '御手洗 翔太', kana: 'みたらい しょうた', unitCode: '01jup', unitName: 'Jupiter', color: '#a3d33a' },
  { id: '029ass', name: 'アスラン＝ベルゼビュートⅡ世', kana: 'あすらん', unitCode: '10caf', unitName: 'Café Parade', color: '#6967ab' },
]
const translated = { '001tom': '天濑冬马', '002sho': '御手洗翔太', '029ass': '阿斯兰·别西卜II世' }
const callbacks = { idolName: code => translated[code] || '', idolSearch: (code, fallback) => `${translated[code] || ''} ${fallback || ''}` }

function withState(component, values) {
  return { ...component, setup(props, ctx) {
    const state = component.setup(props, ctx)
    for (const [key, value] of Object.entries(values)) state[key].value = value
    return state
  } }
}
const render = (component, props) => renderToString(createSSRApp(component, props))
const strongs = html => [...html.matchAll(/<strong[^>]*>([^<]*)<\/strong>/g)].map(match => match[1])

const server = await createServer({ configFile: false, root, plugins: [vue()], logLevel: 'error', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, watch: null }, appType: 'custom' })
let checks = 0
try {
  globalThis.document = { activeElement: null }
  const { default: Picker } = await server.ssrLoadModule('/src/components/archive/terminal/ArchiveIdolPickerPanel.vue')
  const { default: Welcome } = await server.ssrLoadModule('/src/components/archive/ArchiveWelcome.vue')

  const all = await render(Picker, { idols, modelValue: '029ass', ...callbacks })
  assert.match(all, /3 位偶像/)
  assert.deepEqual(strongs(all), ['天濑冬马', '御手洗翔太', '阿斯兰·别西卜II世'], 'avatars carry the reader-language names, grouped by unit')
  assert.ok(all.includes('已选：阿斯兰·别西卜II世'))
  assert.match(all, /<button[^>]*aria-pressed="true"[^>]*data-idol-code="029ass"/)
  assert.equal((all.match(/aria-pressed="true"[^>]*data-idol-code=/g) || []).length, 1, 'exactly one idol is selected')
  assert.deepEqual([...all.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map(match => match[1]), ['Jupiter', 'Café Parade'])
  checks++

  for (const query of ['阿斯兰', 'アスラン', '  café PARADE  ']) {
    const html = await render(withState(Picker, { query }), { idols, ...callbacks })
    assert.match(html, /1 位偶像/, query)
    assert.ok(html.includes('data-idol-code="029ass"') && !html.includes('data-idol-code="001tom"'), query)
    checks++
  }
  const unit = await render(withState(Picker, { unitFilter: '01jup' }), { idols, ...callbacks })
  assert.match(unit, /2 位偶像/)
  assert.ok(!unit.includes('data-idol-code="029ass"'))
  assert.match(unit, /<button[^>]*aria-pressed="true"[^>]*>Jupiter<\/button>/, 'the unit chip shows its selection')
  const empty = await render(withState(Picker, { query: '不存在的名字' }), { idols, ...callbacks })
  assert.match(empty, /0 位偶像/)
  assert.ok(empty.includes('没有找到符合条件的偶像'))
  const fallback = await render(Picker, { idols, modelValue: '001tom' })
  assert.ok(strongs(fallback).includes('天ヶ瀬 冬馬'), 'without a translation the source name is shown')
  checks += 3

  const welcome = await render(Welcome, { idols, selectionOnly: true, dataReady: true, preferences: { startupIdol: '029ass' }, ...callbacks })
  assert.ok(welcome.includes('已选：阿斯兰·别西卜II世'))
  assert.ok(strongs(welcome).includes('阿斯兰·别西卜II世'), 'Welcome passes the name callback to its picker')
  assert.match(welcome, /<button[^>]*aria-pressed="true"[^>]*data-idol-code="029ass"/)
  assert.ok(!/terminal-|has-wallpaper|SideM <b>ARCHIVE/.test(welcome), 'the picker page is an archive page, not the terminal')
  const unselected = await render(Welcome, { idols, selectionOnly: true, dataReady: true, preferences: { startupIdol: 'missing' }, ...callbacks })
  assert.ok(unselected.includes('请选择一位偶像'))
  checks += 2
} finally {
  delete globalThis.document
  await server.close()
}

// Every surface carries its own styles: nothing imports the retired terminal sheet, and the shared
// dialog defines its own frame (the portal's scope dialog never imported that sheet itself).
function walk(dir) { return readdirSync(dir).flatMap(name => { const file = path.join(dir, name); return statSync(file).isDirectory() ? walk(file) : [file] }) }
assert.ok(!existsSync(path.join(root, 'src/styles/archive-terminal.css')))
const importers = walk(path.join(root, 'src')).filter(file => /\.(vue|js)$/.test(file) && read(path.relative(root, file)).includes('archive-terminal.css'))
assert.deepEqual(importers, [])
const dialog = read('src/components/archive/terminal/ArchiveTerminalDialog.vue')
assert.match(dialog, /<style>[\s\S]*\.terminal-dialog \{[\s\S]*\.terminal-dialog-header \{[\s\S]*\.terminal-dialog-body \{[\s\S]*\.terminal-icon-button \{/)
assert.doesNotMatch(read('src/components/archive/ArchiveOnboarding.vue'), /:deep\([^)]*(picker|terminal)/, 'the onboarding uses the picker as it is')
checks += 2

console.log(`Idol picker: ${checks} checks — display names, search, unit filter, selection, Welcome wiring and self-styled surfaces`)
