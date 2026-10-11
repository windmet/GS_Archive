import translationRelease from '../../../config/translation-release.json' with { type: 'json' }
import { createBoundedTextTransport } from '../../utils/BoundedTextTransport.js'

// Chats (personal and unit talks, random topics) are legacy compiled files without text units. Their
// translations are keyed by source text in the lazily loaded chats overlay, shared by every chat.
const url = `/translations/zh-CN/archive-general/chats.json?rev=${translationRelease.release}`
const transport = createBoundedTextTransport({ maxBytes: 8 * 1024 * 1024 })
let pending = null

export function loadChatTranslations({ signal } = {}) {
  pending ||= transport.load(url, { signal }).then(text => {
    const data = JSON.parse(text)
    if (data?.schemaVersion !== 1 || !data.entries || typeof data.entries !== 'object') throw Error('Invalid chat translation overlay')
    return data.entries
  }).catch(error => { pending = null; transport.invalidate(url); throw error })
  return pending
}

/** A chat line, a reply choice or its full reply, by exact source text. */
export function chatTranslation(entries, source) {
  if (!entries || typeof source !== 'string' || !source) return ''
  return entries['chat-line']?.text?.[source] || entries['chat-choice']?.text?.[source] || entries['chat-choice']?.detail?.[source] || ''
}

/** Legacy chat files carry no text units: no dialogue or option has a text_ref. */
export function isLegacyChat(compiled) {
  const steps = compiled?.steps || []
  return steps.some(step => step?.type === 'talk') && !steps.some(step => step?.dialogue?.text_ref)
}
