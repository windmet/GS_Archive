function numeric(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function unique(values) {
  return [...new Set(values.filter(value => value !== undefined && value !== null && value !== ''))]
}

export function buildCompiledGroupTitleMap(compiledIndex) {
  const titles = new Map()

  function visit(value) {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (Array.isArray(value.files) && typeof value.title === 'string') {
      for (const file of value.files) {
        if (typeof file === 'string' && !titles.has(file)) titles.set(file, value.title)
      }
    }
    Object.values(value).forEach(visit)
  }

  visit(compiledIndex?.categories || [])
  return titles
}

function episodePlayback(episode, story, episodeIndex) {
  const part = String(episode.resource_id || '').match(/_([a-z])$/i)?.[1] || ''
  const boundaries = story?.episodes || []
  const boundary = boundaries.find(item => item.episode_part === part) || boundaries[episodeIndex] || null
  const episodeFile = boundary?.episode_file || ''
  const rawStart = numeric(boundary?.start_step_index)
  const playableStart = episodeFile
    ? numeric(boundary?.local_playable_start_index)
    : (episodeIndex === 0 ? Math.max(rawStart, numeric(story?.playableStartIndex)) : rawStart)

  return {
    ...episode,
    part,
    exists: Boolean(story?.exists && boundary),
    file: episodeFile || story?.file || episode.compiled_file || '',
    startStep: boundary ? playableStart + 1 : 0,
    endStep: boundary
      ? (episodeFile ? numeric(boundary.step_count) : numeric(boundary.end_step_index) + 1)
      : 0,
    stepCount: numeric(boundary?.step_count),
    dialogueCount: numeric(boundary?.dialogue_count),
    voiceCount: numeric(boundary?.voice_count),
  }
}

export function buildIdolStoryPage(
  episodeIndex,
  mobileArchive,
  storyCatalog,
  idolDictionary,
  idolCode,
  birthdayDomain = null,
) {
  const chapter = episodeIndex?.by_idol_code?.[idolCode]?.[0]
  if (!chapter) return null
  const idol = idolDictionary?.by_idol_code?.[idolCode] || {}
  const mobileScenarios = mobileArchive?.scenarios || []
  const birthdayEntries = (birthdayDomain?.logicalEntries || []).filter(entry =>
    entry.subject?.code === idolCode,
  )
  const sections = (chapter.sections || []).map(section => {
    const storiesByFile = new Map()
    for (const episode of section.episodes || []) {
      if (!storiesByFile.has(episode.compiled_file)) {
        storiesByFile.set(
          episode.compiled_file,
          storyCatalog?.find(entry => entry.file === episode.compiled_file) || null,
        )
      }
    }
    const fileIndexes = new Map()
    const episodes = (section.episodes || []).map(episode => {
      const index = fileIndexes.get(episode.compiled_file) || 0
      fileIndexes.set(episode.compiled_file, index + 1)
      return episodePlayback(episode, storiesByFile.get(episode.compiled_file), index)
    })
    const stories = [...storiesByFile.values()].filter(Boolean)
    const story = stories.find(entry => entry.preplaySynopsis?.text) || stories[0] || null
    const compiledFiles = new Set((section.episodes || []).map(episode => episode.compiled_file).filter(Boolean))
    const sharedBirthdayEntries = birthdayEntries.filter(entry => compiledFiles.has(entry.compiledFile))
    const episodeIds = new Set(episodes.map(episode => numeric(episode.id)))
    const communications = mobileScenarios.filter(scenario =>
      scenario.kind === 'idol_phone' &&
      scenario.idol_code === idolCode &&
      scenario.release_condition?.kind === 'idol_story_episode_finished' &&
      episodeIds.has(numeric(scenario.release_condition?.param_a)),
    )
    const products = unique(episodes.flatMap(episode => episode.products || []).map(product =>
      `${product.product_type}:${product.product_id || 0}:${product.amount || 0}`,
    )).map(key => {
      const [productType, productId, amount] = key.split(':').map(Number)
      return { productType, productId, amount }
    })

    return {
      ...section,
      story,
      synopsis: story?.preplaySynopsis || null,
      episodes,
      communications,
      products,
      playableEpisodeCount: episodes.filter(episode => episode.exists).length,
      dialogueCount: episodes.reduce((sum, episode) => sum + episode.dialogueCount, 0),
      voiceCount: episodes.reduce((sum, episode) => sum + episode.voiceCount, 0),
      sharedBirthdayEntries,
    }
  })

  return {
    ...chapter,
    color: idol.color || '#168f87',
    birthday: idol.birthday || '',
    unitName: idol.unit_name || '',
    sections,
    sectionCount: sections.length,
    episodeCount: sections.reduce((sum, section) => sum + section.episodes.length, 0),
    playableEpisodeCount: sections.reduce((sum, section) => sum + section.playableEpisodeCount, 0),
    communicationCount: sections.reduce((sum, section) => sum + section.communications.length, 0),
    birthdayArchive: {
      entryCount: birthdayEntries.length,
      sharedEntryCount: birthdayEntries.filter(entry =>
        sections.some(section => section.sharedBirthdayEntries.includes(entry)),
      ).length,
    },
  }
}

export function buildIdolStoryOptions(episodeIndex, idolDictionary) {
  return (episodeIndex?.chapters || []).map(chapter => {
    const idol = idolDictionary?.by_idol_code?.[chapter.idol_code] || {}
    return {
      idolCode: chapter.idol_code,
      idolName: chapter.idol_name,
      unitName: idol.unit_name || '',
      color: idol.color || '#168f87',
      sectionCount: chapter.sections?.length || 0,
      episodeCount: (chapter.sections || []).reduce((sum, section) => sum + (section.episodes?.length || 0), 0),
    }
  })
}

function conditionLabel(condition, title) {
  if (!condition) return '开放条件未记录'
  if (condition.kind === 'scenario_title_mission') return title || '任务达成'
  if (condition.kind === 'term_or_default_release') return '期间开放'
  if (condition.kind === 'idol_story_episode_finished') return `个人故事 ${condition.param_a} 完成`
  if (condition.kind === 'card_acquired') return `获得卡片 ${condition.param_a}`
  if (condition.kind === 'card_awakened') return `卡片 ${condition.param_a} 特训完成`
  if (condition.kind === 'card_limit_break') return `卡片 ${condition.param_a} 突破 ${condition.param_b || 4} 次`
  return `条件 ${condition.type}`
}

export function groupMobileScenarios(scenarios, titleMap = new Map()) {
  const groups = new Map()
  for (const scenario of scenarios || []) {
    const key = scenario.compiled_file || `missing:${scenario.id}`
    const group = groups.get(key) || {
      id: key,
      kind: scenario.kind,
      file: scenario.compiled_file || '',
      exists: Boolean(scenario.compiled_exists),
      title: titleMap.get(scenario.compiled_file) || '',
      scenarios: [],
      unlocks: [],
      cardIds: [],
      releaseAt: numeric(scenario.term?.start_at),
    }
    group.scenarios.push(scenario)
    group.unlocks.push({
      id: scenario.id,
      text: conditionLabel(scenario.release_condition, scenario.title),
      kind: scenario.release_condition?.kind || 'unknown',
      condition: scenario.release_condition,
    })
    if (['card_acquired', 'card_awakened', 'card_limit_break'].includes(scenario.release_condition?.kind)) {
      group.cardIds.push(numeric(scenario.release_condition?.param_a))
    }
    if (!group.title && group.scenarios.length === 1 && !['scenario_title_mission'].includes(scenario.release_condition?.kind)) {
      group.title = scenario.title
    }
    group.releaseAt = Math.min(group.releaseAt || Infinity, numeric(scenario.term?.start_at) || Infinity)
    groups.set(key, group)
  }

  return [...groups.values()].map(group => ({
    ...group,
    title: group.title || (group.kind === 'unit_talk' ? '组合聊天' : group.kind === 'idol_phone' ? '电话通信' : '个人聊天'),
    cardIds: unique(group.cardIds),
    releaseAt: Number.isFinite(group.releaseAt) ? group.releaseAt : 0,
  })).sort((a, b) => a.releaseAt - b.releaseAt || a.title.localeCompare(b.title, 'ja'))
}

export function buildRandomTalkBundles(
  mobileArchive,
  idolCode,
  titleMap = new Map(),
  presentationIndex = null,
) {
  const topics = (mobileArchive?.random_talk?.topics || []).filter(topic => topic.idol_code === idolCode)
  const groups = new Map()
  for (const topic of topics) {
    const key = topic.compiled_file || topic.script_name || `topic:${topic.id}`
    const group = groups.get(key) || {
      id: key,
      file: topic.compiled_file || '',
      exists: Boolean(topic.compiled_exists),
      title: titleMap.get(topic.compiled_file) || '随机 Talk',
      topics: [],
    }
    group.topics.push({
      ...topic,
      presentation: presentationIndex?.by_topic_id?.[String(topic.id)] || null,
    })
    groups.set(key, group)
  }
  return [...groups.values()]
}

export function formatArchiveDate(timestamp) {
  if (numeric(timestamp) < 946684800) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo',
  }).format(new Date(numeric(timestamp) * 1000))
}
