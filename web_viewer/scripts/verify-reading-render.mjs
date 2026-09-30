import assert from 'node:assert/strict'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { readFileSync } from 'node:fs'
import { projectReadingFrontMatter } from '../src/presentation/ReadingFrontMatter.js'
import { readingSynopsisRow } from '../src/presentation/StorySynopsis.js'
import { resolveStoryText } from '../src/localization/story/StoryTextResolver.js'
import { validateStoryTranslationOverlay } from '../src/localization/story/TranslationRepository.js'
import { projectReadingChoiceRows } from '../src/presentation/ReadingChoiceMetadata.js'

// Exercise the actual Vue template's uncommon states without publishing fake stories.
const server = await createServer({ configFile: false, plugins: [vue()], optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, watch: null }, appType: 'custom' })
try {
  const { default: Reader } = await server.ssrLoadModule('/src/components/archive/ArchiveStoryReader.vue')
  const { default: Synopsis } = await server.ssrLoadModule('/src/components/archive/StorySynopsisCard.vue')
  const { default: CollectionSynopsis } = await server.ssrLoadModule('/src/components/archive/CollectionStorySynopsis.vue')
  const { default: ChapterSegment } = await server.ssrLoadModule('/src/components/archive/ChapterReadingSegment.vue')
  const { default: ChapterReader } = await server.ssrLoadModule('/src/components/archive/ChapterStoryReader.vue')
  const { setReaderTheme } = await server.ssrLoadModule('/src/presentation/ReaderTheme.js')
  const synopsisDoc=JSON.parse(readFileSync(new URL('../public/data/reading/1_4_001_01_a.json',import.meta.url)))
  const synopsis=readingSynopsisRow(synopsisDoc)
  for (const theme of ['light','warm','dark','mint']) {
    setReaderTheme(theme)
    const single = await renderToString(createSSRApp(Reader, {state:{status:'ready',entries:[],document:synopsisDoc},documentId:synopsisDoc.document_id,mode:'original',anchor:''}))
    const whole = await renderToString(createSSRApp(ChapterReader, {chapter:{title:'Theme test',label:'第1話',segments:[]},documentId:'',mode:'original',anchor:''}))
    for (const html of [single,whole]) {
      assert.ok(html.includes(`data-theme="${theme}"`), 'both reading scopes inherit the shared preference')
      assert.ok(html.includes('aria-label="阅读主题"'))
      for (const label of ['极简白','护眼暖阳','深夜暗色','冰青冷调（事务所）']) assert.ok(html.includes(`aria-label="${label}"`))
    }
  }
  setReaderTheme('light')
  const sourceBefore = JSON.stringify(synopsisDoc)
  const marker = synopsisDoc.rows.find(row => row.kind === 'choice_detail' && row.source_text === 'appeal')
  assert.ok(marker)
  const projected = projectReadingChoiceRows(synopsisDoc)
  assert.ok(!projected.some(item => item.row === marker))
  assert.ok(projected.some(item => item.row.source_text === 'パーッション！！' && item.anchorAliases.includes(marker.anchor.row_id)))
  assert.equal(JSON.stringify(synopsisDoc), sourceBefore, 'source unit, hash and control evidence remain canonical')
  const proseDoc = structuredClone(synopsisDoc)
  proseDoc.rows.find(row => row.kind === 'choice_detail').source_text = '長い返信本文です。'
  assert.ok(projectReadingChoiceRows(proseDoc).some(item => item.row.source_text === '長い返信本文です。'), 'real long reply stays readable')
  const dialogue = { ...marker, kind: 'dialogue', anchor: { ...marker.anchor, row_id: 'dialogue-appeal' } }
  const option = { ...marker, kind: 'choice', anchor: { ...marker.anchor, row_id: 'option-appeal' } }
  assert.equal(projectReadingChoiceRows({rows:[dialogue,option]}).length, 2, 'same word in dialogue or actual option is not filtered')
  assert.equal(projectReadingChoiceRows({rows:[marker]}).length, 1, 'unpaired evidence is never silently discarded')
  const proseHtml = await renderToString(createSSRApp(Reader, {
    state:{status:'ready',entries:[],document:proseDoc}, documentId:proseDoc.document_id, mode:'original', anchor:'',
  }))
  assert.ok(proseHtml.includes('选项附文') && proseHtml.includes('長い返信本文です。'), 'actual Vue still renders genuine long replies')
  for (const mode of ['original', 'translation', 'bilingual']) {
    const props = { state: { status:'ready', entries:[], document:synopsisDoc }, documentId:synopsisDoc.document_id, mode, anchor:marker.anchor.row_id }
    const readerHtml = await renderToString(createSSRApp(Reader, props))
    const segmentHtml = await renderToString(createSSRApp(ChapterSegment, { segment:{status:'ready',document:synopsisDoc,documentId:synopsisDoc.document_id,label:'EPISODE 01',entry:{sha256:'test'}}, mode, anchor:marker.anchor.row_id, query:'appeal' }))
    for (const html of [readerHtml, segmentHtml]) {
      assert.ok(!html.includes('appeal') && !html.includes('选项附文'), `${mode}: no metadata prose in either reading scope`)
      assert.ok(html.includes('パーッション！！'))
      assert.ok(html.includes(`id="reading-${marker.anchor.row_id}"`), 'old metadata anchor resolves at its actual choice')
    }
  }
  assert.equal(synopsis.text_ref.unit_id,'story-text:v1:1_4_001_01:1_4_001_01_a:cmd-000000:synopsis:000')
  assert.equal(readingSynopsisRow({rows:[synopsisDoc.rows.find(row=>row.kind==='dialogue'),synopsis]}),null,'never treat later content as leading synopsis')
  assert.equal(readingSynopsisRow({rows:[{...synopsis,text_ref:null}]}),null,'plain text cannot unlock translation controls')
  const overlay=JSON.parse(readFileSync(new URL('../public/translations/zh-CN/scenarios/1_4_001_01.json',import.meta.url)))
  assert.equal(validateStoryTranslationOverlay(overlay,{scenarioId:synopsisDoc.text_catalog_id,locale:'zh-CN'}).valid,true)
  const exactEntry=overlay.entries[synopsis.text_ref.unit_id]
  assert.equal(exactEntry.status,'reviewed')
  for(const mode of ['original','translation','bilingual']) {
    const view=resolveStoryText({source:synopsis.source_text,textRef:synopsis.text_ref,overlayEntry:exactEntry,preferences:{story_content_mode:mode}})
    const synopsisHtml=await renderToString(createSSRApp(Synopsis,{view,mode,switchable:true}))
    assert.ok(synopsisHtml.includes('aria-label="简介语言"'))
    assert.ok(synopsisHtml.includes(mode==='original' ? 'ついに始動した315プロダクション！' : '315 Production终于启动！'))
    assert.equal(Boolean(view.secondary),mode==='bilingual')
  }
  const stale=resolveStoryText({source:synopsis.source_text,textRef:synopsis.text_ref,overlayEntry:{...exactEntry,source_hash:'sha256:'+'0'.repeat(64)},preferences:{story_content_mode:'translation'}})
  assert.equal(stale.primary.text,synopsis.source_text,'stale synopsis overlay retains source')
  const fallbackHtml=await renderToString(createSSRApp(CollectionSynopsis,{fallback:{text:synopsis.source_text},title:'Fallback'}))
  assert.ok(fallbackHtml.includes('ついに始動した315プロダクション！'))
  assert.ok(!fallbackHtml.includes('aria-label="简介语言"'),'unbound directory synopsis has no translation controls')
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
  const workLinesHtml = await renderToString(createSSRApp(Work, {
    idol: { idol_code: '001tom', short_stories: [{ id: 'short', title: 'Short', compiled_file: 'short.json' }],
      scene_lines: [{ id: 'line', background_name: 'Office', compiled_file: 'line.json' }] },
    initialFile: '', mode: 'lines',
    readingEntries: [{ document_id: 'line', source_file: 'line.json', status: 'ready' }],
  }))
  assert.ok(workLinesHtml.includes('工作场景台词'), 'explicit Work tab survives a URL-only return without a selected file')
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
  const chapter = JSON.parse(readFileSync(new URL('../public/data/reading/1_1_001_01_a.json', import.meta.url)))
  const firstTitle = chapter.rows[0]
  const frontMatter = projectReadingFrontMatter(chapter.rows, chapter.presentation.title)
  assert.ok(frontMatter.mergedTitleIds.has(firstTitle.anchor.row_id))
  assert.equal(frontMatter.mergedTitleIds.size, 2, 'both leading copies of the heading are projected once')
  assert.ok(frontMatter.frontMatterIds.has(chapter.rows[1].anchor.row_id))
  assert.ok(frontMatter.frontMatterIds.has(chapter.rows[2].anchor.row_id))
  assert.ok(!frontMatter.frontMatterIds.has(chapter.rows.find(row => row.kind === 'dialogue').anchor.row_id))
  assert.equal(projectReadingFrontMatter(chapter.rows, '另一标题').mergedTitleIds.size, 0, 'distinct source title must remain visible')
  const chapterHtml = await renderToString(createSSRApp(Reader, {
    state: { status: 'ready', entries: [], document: chapter }, documentId: chapter.document_id, mode: 'original', anchor: '',
  }))
  assert.ok(chapterHtml.includes(`id="reading-${firstTitle.anchor.row_id}"`), 'merged title anchor stays addressable')
  assert.equal(chapterHtml.split(chapter.presentation.title).length - 1, 1, 'matching leading title is only visually printed once')
  assert.ok(chapterHtml.includes('第1話'), 'distinct structural episode title stays visible')
  assert.ok(chapterHtml.includes('kind-synopsis front-matter'), 'synopsis is projected as front matter')
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
