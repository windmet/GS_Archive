import translationRelease from '../../../config/translation-release.json' with { type: 'json' }
import { createBoundedTextTransport } from '../../utils/BoundedTextTransport.js'

// Chats translate through the General TM. Current compiled chats also carry text_refs;
// the overlay binds those to a tracked chat catalogue and the exact source hash.
const url = `/translations/zh-CN/archive-general/chats.json?rev=${translationRelease.release}`
const transport = createBoundedTextTransport({ maxBytes: 8 * 1024 * 1024 })
let pending = null

export function loadChatTranslations({ signal } = {}) {
  pending ||= transport.load(url, { signal }).then(text => {
    const data = JSON.parse(text)
    if (data?.schemaVersion !== 1 || !data.entries || typeof data.entries !== 'object') throw Error('Invalid chat translation overlay')
    return data
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

// A candidate only triggers loading. Modern text_refs are authorized separately
// below; talk_mode alone never allows a story to borrow a chat translation.
export const isChatCandidate = compiled => isLegacyChat(compiled)
  || (compiled?.steps || []).some(step => step?.state?.talk_mode === true)

export function chatOverlayEntry(overlay, compiled, source, textRef = null) {
  const text = chatTranslation(overlay?.entries, source)
  if (!text) return null
  if (!textRef) return {source_hash:null,text,status:'draft'}
  const catalogue = compiled?.text_catalog_id || compiled?.scenario_id
  const hash = overlay?.source_hashes?.[source]
  if (!overlay?.catalogues?.includes(catalogue) || !textRef.unit_id?.startsWith(`story-text:v1:${catalogue}:`)
    || !/^sha256:[a-f0-9]{64}$/.test(hash || '') || hash !== textRef.source_hash) return null
  return {source_hash:hash,text,status:'draft'}
}
