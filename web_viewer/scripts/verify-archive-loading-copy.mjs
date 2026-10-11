/** Source/SFC checks only; real navigation, audio and device QA are separate.
 * Run from web_viewer with the repository's existing dependencies.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { verifyLoadingBehavior } from './lib/loading-behavior-contract.mjs'

const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
// SFC rendering needs Vue transformation, not the archive's media middleware/watcher.
const server = await createServer({ configFile: false, plugins: [vue()],
  server: { middlewareMode: true, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
let checks = 0
try {
  const { default: LoadingScreen } = await server.ssrLoadModule('/src/components/LoadingScreen.vue')
  const { default: Indicator } = await server.ssrLoadModule('/src/components/GsLoadingIndicator.vue')
  const render = (component, props) => renderToString(createSSRApp(component, props))

  for (const message of ['正在读取资料馆数据…', '正在准备演出…', '正在准备舞台…']) {
    const html = await render(LoadingScreen, { visible: true, message })
    assert.ok(html.includes(message))
    assert.ok(html.includes('Now Loading'))
    checks++
  }
  const waiting = await render(LoadingScreen, {
    visible: true, message: '正在读取资料馆数据…', readiness: { status: 'waiting' },
  })
  assert.ok(waiting.includes('正在准备当前画面…'))
  assert.ok(!waiting.includes('正在读取资料馆数据…'))
  checks++

  const status = { tasks: [
    { priority: 'critical', state: 'fetched' },
    { priority: 'critical', state: 'json-parsed' },
    { priority: 'critical', state: 'failed' },
    { priority: 'background', state: 'fetched' },
    { priority: 'critical', required: false, state: 'fetched' },
    { priority: 'critical', state: 'deferred' },
    { priority: 'critical', state: 'excluded' },
  ] }
  const partial = await render(LoadingScreen, { visible: true, status })
  assert.match(partial, /当前段落资源：\s*2\s*\/\s*3/)
  assert.ok(!partial.includes('资源已预载，正在准备画面与语音…'))
  assert.ok(!partial.includes('aria-valuenow'), 'A task count is not a download percentage')
  checks++
  const readyTasks = await render(LoadingScreen, {
    visible: true, status: { tasks: status.tasks.slice(0, 2) },
  })
  assert.ok(readyTasks.includes('资源已预载，正在准备画面与语音…'))
  assert.ok(readyTasks.includes('loading-screen'), 'Prewarmed is not permission to hide the curtain')
  checks++
  const empty = await render(LoadingScreen, { visible: true })
  assert.ok(!empty.includes('当前段落资源：'))
  assert.ok(!empty.includes('取消并返回'))
  checks++
  const cancel = await render(LoadingScreen, { visible: true, canCancel: true, surface: 'player' })
  assert.ok(cancel.includes('取消并返回'))
  assert.ok(cancel.includes('loading-screen--player'))
  const hidden = await render(LoadingScreen, { visible: false, canCancel: true })
  assert.ok(!hidden.includes('Now Loading'))
  assert.ok(!hidden.includes('取消并返回'))
  checks++
  for (const message of ['正在准备下一页…', '正在准备下一段画面…', '正在载入正文…', '次のエピソードを読み込み中…']) {
    const html = await render(Indicator, { message, variant: 'inline' })
    assert.ok(html.includes(message))
    assert.ok(!html.includes('Now Loading'))
    assert.ok(html.includes('role="status"'))
    checks++
  }

  await verifyLoadingBehavior({ source, render, LoadingScreen })
  const { default: Reader } = await server.ssrLoadModule('/src/components/archive/ArchiveStoryReader.vue')
  for (const status of ['loading', 'error', 'empty']) {
    const html = await render(Reader, { state: { status, document: null, entries: [], error: 'controlled failure' }, mode: 'original' })
    assert.equal(html.includes('正在载入正文…'), status === 'loading')
    assert.equal(html.includes('正文暂时无法载入'), status === 'error')
    assert.equal(html.includes('这个分段没有可显示的正文。'), status === 'empty')
    checks++
  }
  console.log(`Loading: ${checks} SSR cases plus production route, curtain, timer and translation behavior passed; layout, animation, device and full-route QA remain separate.`)
} finally {
  await server.close()
}
