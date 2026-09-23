import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'

const server = await createServer({ configLoader: 'native', server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: LoadingScreen } = await server.ssrLoadModule('/src/components/LoadingScreen.vue')
  for (const message of ['正在读取资料馆数据…', '正在准备演出…', '正在准备舞台…']) {
    const html = await renderToString(createSSRApp(LoadingScreen, { visible: true, message }))
    assert.ok(html.includes(message))
  }
  const waiting = await renderToString(createSSRApp(LoadingScreen, {
    visible: true, message: '正在读取资料馆数据…', readiness: { status: 'waiting' },
  }))
  assert.ok(waiting.includes('正在准备当前画面…'))
  const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  assert.match(app, /loadingPurpose\.value === 'stage' \? '正在准备舞台…' : '正在读取资料馆数据…'/)
  assert.match(app, /:message="loadingMessage"/)
  const lab = readFileSync(new URL('../src/components/SpineViewer.vue', import.meta.url), 'utf8')
  assert.match(lab, /!manifest \? \(loading \? '正在读取动作库…' : '动作库载入失败'\)/)
  const reader = readFileSync(new URL('../src/components/archive/ArchiveStoryReader.vue', import.meta.url), 'utf8')
  assert.match(reader, /!translationLoadFailed && fallbackCount/)
  assert.match(reader, /mode !== 'original' && translationLoadFailed/)
  console.log('Archive loading copy: explicit data/playback/stage messages and mutually exclusive Reader notices passed')
} finally {
  await server.close()
}
