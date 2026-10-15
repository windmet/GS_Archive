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
