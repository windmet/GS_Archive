import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { uiLocale, setUiLocale, syncDocumentLanguage } from '../src/localization/ui/UiLocaleStore.js'

// The document language is the interface language: zh-CN in index.html for the first paint, then
// whatever the UI locale becomes. The story display mode never changes it.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
assert.match(html, /<html lang="zh-CN">/, 'index.html declares the default interface language')
assert.match(html, /<title>GS Archive · SideM GROWING STARS 资料馆<\/title>/, 'index.html carries the archive title')

const doc = { documentElement: { lang: '' } }
const stop = syncDocumentLanguage(doc)
assert.equal(doc.documentElement.lang, uiLocale.value, 'the current locale is written at once')
setUiLocale('ja-JP')
assert.equal(doc.documentElement.lang, 'ja-JP', 'switching to Japanese follows')
setUiLocale('zh-CN')
assert.equal(doc.documentElement.lang, 'zh-CN', 'switching back follows')
setUiLocale('fr-FR')
assert.equal(doc.documentElement.lang, 'zh-CN', 'an unsupported locale falls back to Chinese')
stop()

// Story text keeps its own Japanese markers, so a Chinese document can still hold Japanese passages.
const block = readFileSync(new URL('../src/components/LocalizedTextBlock.vue', import.meta.url), 'utf8')
assert.equal((block.match(/:lang="content\.(primary|secondary)\.locale \|\| undefined"/g) || []).length, 2, 'story text marks the language of each passage')
console.log('Document language: index.html is zh-CN and documentElement.lang follows the UI locale')
