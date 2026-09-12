import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { readFileSync } from 'node:fs'

// Exercise the actual Vue template's uncommon states without publishing fake stories.
const server = await createServer({ configLoader: 'native', server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: Reader } = await server.ssrLoadModule('/src/components/archive/ArchiveStoryReader.vue')
  const { default: Event } = await server.ssrLoadModule('/src/components/archive/ArchiveEventDetail.vue')
  const eventHtml = await renderToString(createSSRApp(Event, {
    event: { event_id: 'test', event_code: 'test', title: 'Event', exists: true },
    episodes: [{ id: 'a', file: 'episodes/a.json', label: 'Ready' }, { id: 'b', file: 'episodes/b.json', label: 'Branch' }],
    readingEntries: [{ document_id: 'a', source_file: 'episodes/a.json', status: 'ready' },
      { document_id: 'b', source_file: 'episodes/b.json', status: 'unsupported' }],
  }))
  assert.ok(eventHtml.includes('aria-label="阅读 Ready"'))
  assert.ok(!eventHtml.includes('class="event-logo"'), 'promotional banner must not gain a duplicate late-loading logo')
  assert.ok(!eventHtml.includes('aria-label="阅读 Branch"'), 'unsupported episodes retain only their playback entry')
  const { default: Work } = await server.ssrLoadModule('/src/components/archive/ArchiveWorkStory.vue')
  for (const initialFile of ['', 'line.json']) {
    const workHtml = await renderToString(createSSRApp(Work, {
      idol: { idol_code: '001tom', short_stories: [{ id: 'short', title: 'Short', compiled_file: 'short.json' }],
        scene_lines: [{ id: 'line', background_name: 'Office', compiled_file: 'line.json' }] }, initialFile,
      readingEntries: ['short', 'line'].map(id => ({ document_id: id, source_file: `${id}.json`, status: 'ready' })),
    }))
    assert.ok(workHtml.includes(`aria-label="阅读 ${initialFile ? 'Office' : 'Short'}"`), 'work return opens the matching content tab')
  }
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
  const document = JSON.parse(readFileSync(new URL('../public/data/reading/1_4_001_01_d.json', import.meta.url)))
  const html = await renderToString(createSSRApp(Reader, {
    state: { status: 'ready', entries: [], document }, documentId: document.document_id, mode: 'original', anchor: '',
  }))
  assert.equal(html.split('播放完整剧情（实验）').length - 1, 1)
  assert.ok(!html.includes('从这里演出') && !html.includes('记住此处'))
  assert.ok(!html.includes('role="search"'), 'search starts collapsed')
  for (const row of document.rows) assert.ok(html.includes(`id="reading-${row.anchor.row_id}"`), 'all source row anchors survive')
  const prologue = JSON.parse(readFileSync(new URL('../public/data/reading/1_4_001_00_a.json', import.meta.url)))
  for (const mode of ['original', 'translation', 'bilingual']) {
    const rendered = await renderToString(createSSRApp(Reader, {
      state: { status: 'ready', entries: [], document: prologue }, documentId: prologue.document_id, mode, anchor: '',
    }))
    const shu = rendered.split('id="reading-1_4_001_00_a:step-12:text"')[1].split('</section>')[0]
    assert.ok(shu.includes('image_chara_icon_047shu.png'), mode)
    assert.ok(shu.includes('？？？') && !shu.includes('天峰'), mode)
    assert.ok(shu.includes('alt=""') && !shu.includes('aria-label=') && !shu.includes('title='), 'no auxiliary name disclosure')
    if (mode === 'original') {
      const producer = rendered.split('id="reading-1_4_001_00_a:step-13:text"')[1].split('</section>')[0]
      assert.ok(producer.includes('から、今日まで'), 'actual Reader template removes textbox-only line break')
      assert.ok(!producer.includes('から、\n今日まで'))
    }
  }
  console.log('Reader Vue rendering verified: status branches, episode action, collapsed search and retained row anchors')
} finally {
  await server.close()
}
