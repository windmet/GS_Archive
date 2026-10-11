export const READING_SOURCE_FILE = /^(?:episodes\/)?[A-Za-z0-9_-]+\.json$/
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]))

/** Catalog-owned discovery; readCompiled is injected so no directory crawl or
 * media loader decides what is published. Missing/invalid inputs stay audited. */
// Seasonal campaigns (Valentine / White Day) are not in the story catalog; their index names every
// story file and the episode resource ids it holds, so they read like any other collection: one
// document per listed episode. A participant's episodes across all campaigns form one Reader
// chapter (Valentine → White Day, 2022 → 2023); the four shared openings form another.
export const SEASONAL_SEASON_LABEL = { valentine: '情人节', white_day: '白色情人节' }
const SEASON_ORDER = { valentine: 0, white_day: 1 }
const CIRCLED = ['①', '②', '③', '④']
export const seasonalCampaignOrder = campaigns => [...campaigns]
  .sort((a, b) => a.year - b.year || SEASON_ORDER[a.season] - SEASON_ORDER[b.season])
export const seasonalDirectoryId = participant => participant ? `seasonal-participant:${participant.participant_code}` : 'seasonal-common'

export function seasonalReadingEntries(seasonalIndex) {
  const byFile = new Map()
  seasonalCampaignOrder(seasonalIndex?.campaigns || []).forEach((campaign, campaignOrder) => {
    const campaignLabel = `${campaign.year} ${SEASONAL_SEASON_LABEL[campaign.season]}`
    const directory = (participant, episodes, episode) => {
      const position = episodes.indexOf(episode)
      return { directory_id: seasonalDirectoryId(participant), directory_order: campaignOrder * 10 + position,
        navigation_label: episodes.length > 1 ? `${campaignLabel} ${CIRCLED[position]}` : campaignLabel }
    }
    const episodes = [
      ...(campaign.introduction || []).map(episode => ({ episode, ...directory(null, campaign.introduction, episode) })),
      ...(campaign.participants || []).flatMap(participant => (participant.episodes || [])
        .map(episode => ({ episode, ...directory(participant, participant.episodes, episode) }))),
    ]
    for (const { episode, ...reading } of episodes) {
      if (!episode.compiled_file) continue
      const entry = byFile.get(episode.compiled_file) || { domain: 'seasonal', file: episode.compiled_file,
        exists: episode.compiled_exists === true, resourceIds: [], readingEpisodes: {} }
      entry.resourceIds.push(episode.resource_id)
      entry.readingEpisodes[episode.resource_id] = { title: episode.title || null, ...reading }
      // A file without episode boundaries is one document named after the file.
      entry.readingEpisodes[episode.compiled_file.replace(/\.json$/, '')] ||= { title: episode.title || null, ...reading }
      byFile.set(episode.compiled_file, entry)
    }
  })
  return [...byFile.values()]
}

export async function discoverReadingSources({ catalog, publications, readCompiled, idolEpisodeIndex = null, seasonalIndex = null }) {
  const candidates = new Map(), excluded = []
  const chapters = (catalog.collectionStructure || []).flatMap(section => section.chapters)
  // Personal stories are not in collectionStructure; their episode names live in the idol episode index.
  // A birthday chapter's small talks and episodes are separate files but one in-game section.
  const idolEpisodes = new Map((idolEpisodeIndex?.chapters || []).flatMap(chapter => chapter.sections)
    .flatMap(section => section.episodes).map(episode => [episode.resource_id, episode]))
  const idolDirectory = id => {
    const episode = idolEpisodes.get(id)
    return episode ? { navigation_label: episode.name, directory_id: `idol-story-section:${episode.section_id}`, directory_order: episode.sort_order } : {}
  }
  for (const entry of [...catalog.entries, ...seasonalReadingEntries(seasonalIndex)]) {
    const exclude = (file, reason) => excluded.push({ file, domain: entry.domain, reason })
    if (!entry.exists) { exclude(entry.file, 'catalog-source-unavailable'); continue }
    if (!READING_SOURCE_FILE.test(entry.file) || entry.file.startsWith('episodes/')) throw Error('Invalid catalog source file')
    let parent
    try { parent = await readCompiled(entry.file) } catch (error) { exclude(entry.file, `source-read:${error.code || error.message}`); continue }
    const boundaryIds = (parent.data.episodes || []).map(episode => episode.source_scenario_id).filter(Boolean)
    const ids = boundaryIds.filter(id => entry.resourceIds.includes(id))
    // Sources without separate episode boundaries are complete file documents.
    const files = ids.length ? ids.map(id => `episodes/${id}.json`) : [entry.file]
    const fullSpanEpisode = ids.length === 1 && parent.data.episodes?.length === 1 &&
      parent.data.steps?.length > 0 &&
      parent.data.episodes[0].start_step_id === parent.data.steps[0].step_id &&
      parent.data.episodes[0].end_step_id === parent.data.steps.at(-1).step_id
    for (const episodeFile of files) {
      let file = episodeFile
      if (!READING_SOURCE_FILE.test(file)) throw Error('Invalid episode source file')
      let source
      try { source = file === entry.file ? parent : await readCompiled(file) } catch (error) {
        if (error.code !== 'ENOENT' || !fullSpanEpisode) { exclude(file, `source-read:${error.code || error.message}`); continue }
        // A complete single-episode parent already contains the canonical text.
        file = entry.file
        source = parent
      }
      const id = episodeFile.replace(/^episodes\//, '').replace(/\.json$/, '')
      const publication = publications.find(p => p.artifacts.some(a => a.path === `public/data/compiled/${file}`))
      if (source.data.schema_version === 2 && !publication) { exclude(file, 'strict-source-not-in-publication-registry'); continue }
      if (file !== entry.file && (source.data.scenario_id !== id ||
          (!publication && source.data.aggregate_source?.file !== entry.file))) {
        exclude(file, 'episode-aggregate-identity-mismatch'); continue
      }
      const chapter = chapters.find(chapter => chapter.file === entry.file)
      const episode = chapter?.episodes.find(episode => episode.resourceId === id)
      const eventEpisode = (catalog.eventEpisodeStructure || []).flatMap(group => group.episodes).find(episode => episode.resourceId === id)
      const candidate = { document_id: id, file, parent_file: entry.file, domain: entry.domain,
        logical_id: publication?.logical_id || `story-collection:${entry.file.replace(/\.json$/, '')}`,
        title: chapter?.title || entry.readingEpisodes?.[id]?.title || entry.officialTitle || entry.summary?.title || entry.titles?.[0] || null,
        episode_label: episode?.label || eventEpisode?.label || (file === entry.file ? entry.episodeLabel : null) || null,
        // Directory-only label: it goes to the manifest entry, not the document body, so reviewed
        // documents keep the bytes their translation receipts pinned.
        ...(entry.domain === 'idol_story' ? idolDirectory(id) : {}),
        ...(entry.readingEpisodes?.[id] ? pick(entry.readingEpisodes[id], ['navigation_label', 'directory_id', 'directory_order']) : {}),
        publication: publication ? { kind: 'authoritative-registry', ownership: publication.ownership }
          : { kind: 'catalog-compatibility', aggregate_file: entry.file } }
      const previous = candidates.get(id)
      if (previous && previous.file !== file) throw Error(`Reading identity collision: ${id}`)
      if (!previous) candidates.set(id, candidate)
    }
  }
  return { candidates: [...candidates.values()].sort((a, b) => a.document_id.localeCompare(b.document_id)), excluded }
}
