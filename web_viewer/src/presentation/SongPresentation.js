// Product-facing song data is projected from evidence plus the canonical identity dictionary.
// Resource existence is not a playback guarantee. Keep collected media and playable media distinct.
export function buildSongPresentation(song, identity, { playbackTrack = null, audioExperiment = null } = {}) {
  if (!song) return null
  const idols = identity?.by_idol_code || Object.fromEntries((identity?.idols || []).map(entry => [entry.idol_code, entry]))
  const units = new Map((identity?.units || []).map(entry => [entry.unit_code, entry]))
  const idol = code => ({
    id: code, displayName: idols[code]?.display_name || '姓名待确认',
    actionable: Boolean(idols[code]?.display_name),
  })
  const unit = code => {
    // Audio resource aliases have three numeric digits; canonical units have two.
    const id = /^0\d{2}[a-z0-9]{3}$/.test(code || '') ? code.slice(1) : code
    return { id, displayName: units.get(id)?.unit_name || '组合待确认', actionable: Boolean(units.get(id)?.unit_name) }
  }
  const mapping = song.performance_mapping || {}
  const scopes = {
    configurable_formation: ['自由编成', '演唱成员随编成而变化，不表示全员同时合唱。'],
    fixed_special_lineup: ['特别编成', '由以下成员共同演唱，不归属于单一组合。'],
    unspecified_special: ['特别演出', '演唱成员尚未明确收录。'],
  }
  const scope = scopes[mapping.performer_scope] || ['演唱信息', '演唱范围尚待确认。']
  const experiment = audioExperiment ? {
    ...audioExperiment,
    solo_tracks: Object.fromEntries(Object.entries(audioExperiment.solo_tracks || {}).map(([key, track]) => [key, {
      ...track, displayName: idol(track.idol_code).displayName,
    }])),
    unit_tracks: (audioExperiment.unit_tracks || []).map(track => ({ ...track, label: unit(track.unit_code).displayName })),
  } : null
  const openAt = Number(song.open_at)
  return {
    id: song.song_code, title: song.title || '曲名待确认', kana: song.kana || '', jacketUrl: song.jacket_url,
    parentId: song.parent_song_code,
    special: song.archive_status === 'special',
    openDate: song.archive_status === 'special' ? '特殊版本' : song.archive_status === 'initial' ? '初始收录'
      : song.open_at != null && Number.isFinite(openAt) ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeZone: 'Asia/Tokyo' }).format(new Date(openAt * 1000)) : '未收录',
    formLabel: ({ layered: '分轨演唱', oneshot: '演出语音', 'single-cue': '完整混音' })[song.audio_form] || '音频资料',
    credits: (song.credits || '').split('\n').filter(Boolean),
    unit: mapping.confirmed_unit ? unit(mapping.confirmed_unit.unit_code) : null,
    scopeLabel: scope[0], scopeDescription: scope[1],
    performerNote: mapping.performer_basis === 'confirmed_unit_roster' ? '按已确认的演唱组合列出成员。' : '',
    performers: (mapping.performer_idol_codes || []).map(idol),
    variants: (song.variants || []).map(entry => ({ id: entry.song_code, title: entry.title || '版本名称待确认' })),
    audioGroups: [
      { title: '组合演唱版本', kind: 'unit', entries: (song.audio?.unit_codes || []).map(unit), note: '' },
      { title: '演出语音', kind: 'idol', entries: (song.audio?.oneshot_idol_codes || []).map(idol), note: '成员的简短演出语音，不是个人独唱。' },
      { title: '个人声部', kind: 'idol', entries: (song.audio?.idol_vocal_codes || []).map(idol), note: '已收录的个人演唱声部。' },
    ].filter(group => group.entries.length),
    fullMixCollected: Boolean(song.audio?.has_full_mix),
    playback: { track: playbackTrack?.url ? playbackTrack : null, experiment },
    playbackLabel: experiment ? '可试听 · 实验混音' : playbackTrack?.url ? '可试听' : '暂未提供试听',
    movies: (song.movies || []).map((entry, index) => ({ id: `${entry.kind}:${index}`, title: entry.kind === '3dmv' ? '3DMV' : 'MV LIVE', status: '已收录关联资料' })),
    related: (song.related_entities || []).map(entry => ({ title: entry.title || '关联剧情', payload: entry })),
    links: song.links || [],
    technicalEvidence: { catalog: song, playbackTrack, audioExperiment },
  }
}
