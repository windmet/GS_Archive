const text = value => typeof value === 'string' ? value : ''
const nonempty = value => Boolean(text(value).trim())
const normalizeSearch = value => text(value).normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
const validPosition = value => Number.isInteger(value) && value >= 1 && value <= 5
const centerLabels = new Map([['solo', 'Solo'], ['solo_multi', 'Solo Multi'], ['solo_single', 'Solo Single']])
const categoryLabels = {
  collective: '全员 / 自由编成',
  unit: '组合',
  special: '特别编成 / 演出',
  unknown: '其他曲目',
}

// Accept the regular songs directory's rows/map, or its { songs } catalog wrapper.
// Variant summaries provide identity/title/status only; never inherit a parent's roster.
function directoryByCode(directory) {
  const value = directory?.songs || directory
  const rows = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []
  const records = new Map()
  for (const row of rows) {
    if (!nonempty(row?.song_code)) continue
    records.set(row.song_code, records.has(row.song_code) ? null : row)
  }
  const variantRecords = new Map()
  for (const row of records.values()) {
    for (const variant of Array.isArray(row?.variants) ? row.variants : []) {
      if (!nonempty(variant?.song_code) || records.has(variant.song_code)) continue
      const summary = { song_code: variant.song_code, title: text(variant.title), archive_status: text(variant.archive_status) }
      const previous = variantRecords.get(variant.song_code)
      variantRecords.set(variant.song_code, previous === undefined ? summary
        : previous && previous.title === summary.title && previous.archive_status === summary.archive_status ? previous : null)
    }
  }
  return new Map([...variantRecords, ...records])
}

function versionFor(script, metadata) {
  const positions = Array.isArray(script.positions) && script.positions.length &&
    script.positions.every(validPosition) && new Set(script.positions).size === script.positions.length ? [...script.positions] : []
  const participantCount = positions.length || null
  const variant = text(script.variant)
  const mode = text(script.vocalSetting?.mode)
  const sourceLabel = text(script.vocalSetting?.label)
  const unitName = mode === 'unit' && /^Unit[：:]\s*/u.test(sourceLabel)
    ? sourceLabel.replace(/^Unit[：:]\s*/u, '').trim() : ''
  let kind = 'standard'
  let label = '标准编排'
  if (mode === 'unit') {
    kind = 'unit'; label = unitName || sourceLabel || '组合编排'
  } else if (mode === 'formation-or-all-stars') {
    kind = 'collective'; label = '全员 / 自由编成'
  } else if (mode === 'center') {
    const rawVariant = text(script.vocalSetting?.rawVariant) || variant
    const variantLabel = centerLabels.get(rawVariant) || rawVariant
    kind = 'center'; label = `单人中心${variantLabel ? ` · ${variantLabel}` : ''}`
  } else if (metadata?.archive_status === 'special') {
    kind = 'special'; label = '特别演出'
  } else if (variant) {
    kind = 'variant'; label = variant === 'tutorial' ? '教学编排' : sourceLabel || `编排 · ${variant}`
  }
  return {
    id: script.id, songCode: script.songCode, variant, kind, label,
    positions, participantCount,
    positionLabel: participantCount ? `${participantCount} 人 · 槽位 ${positions.join(' / ')}` : '人数未确认',
    sourceLabel, unitName, unitCode: text(script.vocalSetting?.unitCode),
  }
}

// Group only by the authored songCode. Keep each exact stage script id selectable.
// Participant count describes the active stage positions, not the recorded singers.
export function buildStageSongLibrary(songs, songDirectory) {
  if (!Array.isArray(songs)) return []
  const directory = directoryByCode(songDirectory)
  const groups = new Map()
  const scriptIds = new Set()
  for (const script of songs) {
    if (!nonempty(script?.id) || !nonempty(script?.songCode)) throw new Error('Stage song requires an exact script id and songCode')
    if (scriptIds.has(script.id)) throw new Error(`Duplicate stage script id: ${script.id}`)
    scriptIds.add(script.id)
    if (!groups.has(script.songCode)) groups.set(script.songCode, [])
    groups.get(script.songCode).push(script)
  }
  return [...groups].map(([songCode, scripts]) => {
    const metadata = directory.get(songCode)
    const versions = scripts.map(script => versionFor(script, metadata))
    const primary = scripts.find(script => !script.variant) || scripts[0]
    const title = nonempty(metadata?.title) ? metadata.title : (nonempty(primary.title) ? primary.title : '')
      || scripts.find(script => nonempty(script.title))?.title || '曲名未收录'
    const scope = text(metadata?.performance?.scope) || text(metadata?.performance_mapping?.performer_scope)
    const unitName = text(metadata?.performance?.unitName) || text(metadata?.performance_mapping?.confirmed_unit?.unit_name)
    let category = 'unknown'
    if (metadata?.archive_status === 'special' || scope === 'fixed_special_lineup' || scope === 'unspecified_special') category = 'special'
    else if (scope === 'fixed_unit') category = 'unit'
    else if (scope === 'configurable_formation' || versions.some(version => version.kind === 'collective')) category = 'collective'
    else if (versions.every(version => version.kind === 'unit')) category = 'unit'
    const attributeKey = ['physical', 'intelli', 'mental', 'all'].includes(metadata?.attribute?.key) ? metadata.attribute.key : ''
    const performers = metadata?.performance?.performers || []
    const searchText = normalizeSearch([title, text(metadata?.kana), songCode, unitName,
      ...scripts.map(script => text(script.title)),
      ...versions.flatMap(version => [version.sourceLabel, version.unitName, version.label, version.id]),
      ...(Array.isArray(performers) ? performers.map(performer => text(performer?.displayName)) : []),
    ].join(' '))
    return {
      songCode, title, kana: text(metadata?.kana), jacketUrl: text(metadata?.jacket_url),
      category, categoryLabel: category === 'unknown' ? '' : categoryLabels[category], attributeKey, unitName, searchText,
      defaultScriptId: primary.id, versions,
    }
  })
}

export function filterStageSongLibrary(library, { query = '', category = 'all', attribute = '' } = {}) {
  if (!Array.isArray(library)) return []
  const terms = normalizeSearch(query).split(' ').filter(Boolean)
  return library.filter(group => (category === 'all' || group.category === category) &&
    (!attribute || group.attributeKey === attribute) && terms.every(term => group.searchText.includes(term)))
}

export function stageSongCategoryOptions(library) {
  const groups = Array.isArray(library) ? library : []
  return [{ id: 'all', label: '全部歌曲', count: groups.length }, ...Object.entries(categoryLabels).map(([id, label]) =>
    ({ id, label, count: groups.filter(group => group.category === id).length })).filter(option => option.count)]
}

export function findStageSongGroup(library, exactScriptId) {
  if (!Array.isArray(library) || !nonempty(exactScriptId)) return null
  return library.find(group => group.versions.some(version => version.id === exactScriptId)) || null
}
