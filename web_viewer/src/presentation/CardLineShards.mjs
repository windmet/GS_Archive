// The card-lines overlay (every card line, touch voice, home voice and call title) is over 1 MiB,
// while a page shows a handful of lines. The generator publishes it a second time split by source
// text, and pages fetch only the shards of the lines they show. card-lines.json stays the whole
// overlay for the translation tools; the browser reads only these shards.
export const CARD_LINE_SHARD_COUNT = 32
export const cardLineShardFile = key => `card-lines/${key}.json`

export function cardLineShardKey(source) {
  let hash = 2166136261
  for (const char of String(source)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return ((hash >>> 0) % CARD_LINE_SHARD_COUNT).toString(16).padStart(2, '0')
}

export const cardLineShardKeys = () => Array.from({length: CARD_LINE_SHARD_COUNT}, (_, n) => n.toString(16).padStart(2, '0'))

// entries: {kind: {field: {source: text}}} -> {key: {schemaVersion, key, entries}}, every key present
// (an empty shard is a valid answer, so a page never asks for a file that does not exist).
export function splitCardLineEntries(entries) {
  const shards = Object.fromEntries(cardLineShardKeys().map(key => [key, {schemaVersion: 1, key, entries: {}}]))
  for (const [kind, fields] of Object.entries(entries)) for (const [field, texts] of Object.entries(fields))
    for (const [source, text] of Object.entries(texts)) ((shards[cardLineShardKey(source)].entries[kind] ||= {})[field] ||= {})[source] = text
  return shards
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
export function validateCardLineShard(value, key) {
  if (value?.schemaVersion !== 1 || value.key !== key || !record(value.entries)) throw Error('Invalid card line shard')
  for (const fields of Object.values(value.entries)) {
    if (!record(fields)) throw Error('Invalid card line shard')
    for (const texts of Object.values(fields)) {
      if (!record(texts)) throw Error('Invalid card line shard')
      for (const [source, text] of Object.entries(texts))
        if (typeof text !== 'string' || cardLineShardKey(source) !== key) throw Error('Misrouted card line')
    }
  }
  return value
}
