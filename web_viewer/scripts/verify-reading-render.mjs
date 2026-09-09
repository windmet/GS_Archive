import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'

// Exercise the actual Vue template's uncommon states without publishing fake stories.
const server = await createServer({ configLoader: 'native', server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: Reader } = await server.ssrLoadModule('/src/components/archive/ArchiveStoryReader.vue')
  for (const [status, expected] of [
    ['loading', '正在载入正文'], ['empty', '没有可显示的正文'],
    ['not-generated', '尚未生成阅读正文'], ['error', '正文暂时无法载入'],
    ['unsupported', '暂不支持完整阅读'],
  ]) {
    const state = { status, entries: [], error: 'controlled failure',
      document: status === 'unsupported' ? { rows: [], controls: [] } : null }
    const html = await renderToString(createSSRApp(Reader, { state, documentId: 'test', mode: 'original', anchor: '' }))
    assert.ok(html.includes(expected), status)
    assert.ok(!html.includes('aria-label="剧情正文"'), `${status} must not expose a continuous transcript`)
    if (status === 'error') assert.ok(html.includes('重试'))
  }
  console.log('Reader Vue rendering verified: loading, empty, not-generated, error/retry and unsupported')
} finally {
  await server.close()
}
