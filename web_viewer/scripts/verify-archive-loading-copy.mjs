/** Source/SFC checks only; real navigation, audio and device QA are separate.
 * Run from web_viewer with the repository's existing dependencies.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'

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

  const loading = source('components/LoadingScreen.vue')
  assert.match(loading, /8000/)
  assert.ok(loading.includes('加载较慢，可继续等待，或取消后重试。'))
  assert.ok(loading.includes('@click.stop="$emit(\'cancel\')"'))
  assert.match(loading, /onUnmounted\(\(\) => clearTimeout\(slowTimer\)\)/)
  assert.ok(loading.includes('criticalPreloadProgress'))
  const indicator = source('components/GsLoadingIndicator.vue')
  assert.match(indicator, /prefers-reduced-motion: reduce/)
  assert.match(indicator, /animation: gs-loading-orbit/)
  checks++

  const app = source('App.vue')
  assert.match(app, /loadingPurpose\.value === 'stage' \? '正在准备舞台…' : '正在读取资料馆数据…'/)
  for (const attr of [':message="loadingMessage"', ':status="preloadStatus"', ':readiness="playbackReadiness"', '@cancel="playbackController.close()"']) assert.ok(app.includes(attr))
  assert.ok(app.includes(':visible="(hardLoading || playbackBuffering) && view !== \'reader\' && !(view === \'player\' && !loading && playbackReadiness?.status === \'waiting\' && playbackReadiness?.hasFrame)"'))
  assert.ok(app.includes('<template #pending>'))
  assert.ok(app.includes('routePending && !archiveShellVisible'))
  assert.ok(!app.includes('class="archive-route-pending"'))
  const shell = source('components/archive/ArchiveShell.vue')
  assert.ok(shell.includes('<slot name="pending" />'))
  assert.ok(shell.includes('.archive-content { grid-row: 2; }'))
  assert.ok(shell.includes('@media (max-width: 760px)'))
  checks++

  const story = source('core/StoryViewer.vue')
  assert.ok(story.includes('v-if="localBuffering && !HIDE_UI"'))
  assert.ok(story.includes(':message="localBufferingText"'))
  assert.ok(story.includes(':message="uiText(\'player.complete.loadingNext\')"'))
  assert.ok(story.includes(':message="uiText(\'player.loading\')"'))
  assert.ok(story.includes('.complete-panel > .complete-actions'))
  assert.ok(!story.includes('.complete-panel div {'))
  assert.ok(story.includes('setStoryRuntimePaused'), 'Keep the new continuous-audio pause policy')
  checks++
  for (const name of ['SpineViewer', 'ChibiStageViewer']) {
    const code = source(`components/${name}.vue`)
    assert.ok(code.includes('<GsLoadingIndicator :message="statusText" tone="dark" />'))
    assert.ok(code.includes('v-else-if="errorText" class="stage-state error-state"'))
  }
  const lab = source('components/SpineViewer.vue')
  assert.match(lab, /!manifest \? \(loading \? '正在读取动作库…' : '动作库载入失败'\)/)
  checks++

  const reader = source('components/archive/ArchiveStoryReader.vue')
  assert.ok(reader.includes('message="正在载入正文…"'))
  assert.ok(reader.includes('v-else-if="state.status === \'error\'"'))
  // c6a6e19 already consolidated Reader notices. The former assertions for
  // two superseded expressions would fail even before this visual patch.
  assert.ok(reader.includes('v-if="state.status === \'ready\' && mode !== \'original\'"'))
  assert.ok(reader.includes('v-if="translationLoadFailed"'))
  const translations = reader.slice(reader.indexOf('const translationStatus = computed'), reader.indexOf('const searchText'))
  const positions = ['if (localization.loading.value)', 'if (translationLoadFailed.value)', 'if (fallbackCount.value)'].map(text => translations.indexOf(text))
  assert.ok(positions.every(p => p >= 0) && positions[0] < positions[1] && positions[1] < positions[2])
  assert.ok(translations.includes('正在读取译文，暂时显示原文。'))
  assert.ok(translations.includes('译文暂时无法载入，当前显示原文。'))
  checks++
  console.log(`Loading skin: ${checks} SFC/source checks passed. This is not device or full-route acceptance.`)
} finally {
  await server.close()
}
