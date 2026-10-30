import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Random-talk topic titles are the topic's opening chat line as the masterdata spells it: line breaks
// as spaces, an emoji as （表情）. They take the line's own translation in that spelling, so a title is
// never translated separately and follows the line when it is revised.
export const titleSpelling = text => text.replace(/<emoji>[^<]*<\/emoji>/g, '（表情）')
const compact = text => titleSpelling(text).replace(/\s+/g, '')
// Chinese joins wrapped lines directly; a break between two Latin words or digits keeps one space.
export const titleTranslation = text => titleSpelling(text)
  .replace(/([A-Za-z0-9])[^\S\n]*\n\s*(?=[A-Za-z0-9])/g, '$1 ').replace(/\s*\n\s*/g, '')

// Compiled chat headings use the first 80 code points of the opening line,
// then turn newlines into spaces (data_pipeline/build_index.py:derive_title).
// Keep this spelling separate from the original source identity in the TM.
export const chatPreviewSpelling = source => [...source].slice(0, 80).join('').replaceAll('\n', ' ').trim()
export function chatPreviewTitleAliases(root, lineTranslations) {
  const chats = JSON.parse(fs.readFileSync(path.join(root, 'translation/studio/source/chat-text-index.json'), 'utf8')).files
  const candidates = new Map()
  for (const chat of Object.values(chats)) {
    const source = chat.rows.find(row => row.kind === 'line')?.source
    const translated = source && lineTranslations?.[source]
    if (!translated) continue
    const title = chatPreviewSpelling(source)
    if (title === source) continue
    const texts = candidates.get(title) || new Set()
    texts.add(titleTranslation(translated)); candidates.set(title, texts)
  }
  // An exact line translation wins. A shortened heading shared by differing
  // translated openings is ambiguous, so leave it in the source language.
  return Object.fromEntries([...candidates].filter(([title, texts]) => texts.size === 1 && !lineTranslations[title])
    .map(([title, texts]) => [title, [...texts][0]]))
}

// title -> translated title, for every topic whose opening line is translated.
export function randomTalkTitleAliases(root, lineTranslations) {
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
  const chats = read('translation/studio/source/chat-text-index.json').files
  const aliases = {}
  for (const topic of Object.values(read('public/data/masterdata/random_talk_presentation_index.json').by_topic_id)) {
    const line = chats[topic.compiled_file]?.rows.find(row => row.step === topic.start_step && row.kind === 'line')
    assert.ok(line && compact(line.source) === compact(topic.title), `Random-talk title drift ${topic.id}`)
    const translation = lineTranslations?.[line.source]
    if (translation && line.source !== topic.title) aliases[topic.title] = titleTranslation(translation)
  }
  return aliases
}
