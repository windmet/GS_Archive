// The game's own Latin attribute labels. Card data spells Intelli as "Intelligence"; the
// archive shows the in-game short form everywhere (cards, songs, filters).
const KEYS = { physical: 'physical', intelli: 'intelli', intelligence: 'intelli', intelligent: 'intelli', mental: 'mental', all: 'all' }
const LABELS = { physical: 'Physical', intelli: 'Intelli', mental: 'Mental', all: 'ALL' }

export function attributeKey(value) {
  return KEYS[String(value || '').trim().toLowerCase()] || ''
}

export function attributeLabel(value) {
  return LABELS[attributeKey(value)] || ''
}
