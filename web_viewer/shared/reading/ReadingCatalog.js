export const READING_SOURCE_FILE = /^(?:episodes\/)?[A-Za-z0-9_-]+\.json$/

/** Catalog-owned discovery; readCompiled is injected so no directory crawl or
 * media loader decides what is published. Missing/invalid inputs stay audited. */
export async function discoverReadingSources({ catalog, publications, readCompiled, idolEpisodeIndex = null }) {
  const candidates = new Map(), excluded = []
  const chapters = (catalog.collectionStructure || []).flatMap(section => section.chapters)
  // Personal stories are not in collectionStructure; their episode names live in the idol episode index.
  // A birthday chapter's small talks and episodes are separate files but one in-game section.
  const idolEpisodes = new Map((idolEpisodeIndex?.chapters || []).flatMap(chapter => chapter.sections)
    .flatMap(section => section.episodes).map(episode => [episode.resource_id, episode]))
  // Four birthday chapters were promoted from the game's combined small-talk file, which has no
  // per-talk boundaries, so their small talks are one whole-file document. It joins the chapter's
  // directory in the first talk's place, labelled with the range it covers.
  const idolEpisodesByFile = new Map()
  for (const episode of idolEpisodes.values()) {
    if (!idolEpisodesByFile.has(episode.compiled_file)) idolEpisodesByFile.set(episode.compiled_file, [])
    idolEpisodesByFile.get(episode.compiled_file).push(episode)
  }
  const idolDirectory = (id, wholeFile) => {
    const episode = idolEpisodes.get(id)
    if (episode) return { navigation_label: episode.name, directory_id: `idol-story-section:${episode.section_id}`, directory_order: episode.sort_order }
    const covered = (idolEpisodesByFile.get(wholeFile) || []).sort((a, b) => a.sort_order - b.sort_order)
    if (covered.length < 2 || new Set(covered.map(item => item.section_id)).size !== 1) return {}
    const first = covered[0].name.match(/^(.*?)(\d+)$/), last = covered.at(-1).name.match(/^(.*?)(\d+)$/)
    const label = first && last && first[1] === last[1] ? `${first[1]}${first[2]}-${last[2]}` : null
    return { navigation_label: label, directory_id: `idol-story-section:${covered[0].section_id}`, directory_order: covered[0].sort_order }
  }
  for (const entry of catalog.entries) {
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
        title: chapter?.title || entry.officialTitle || entry.summary?.title || entry.titles?.[0] || null,
        episode_label: episode?.label || eventEpisode?.label || (file === entry.file ? entry.episodeLabel : null) || null,
        // Directory-only label: it goes to the manifest entry, not the document body, so reviewed
        // documents keep the bytes their translation receipts pinned.
        ...(entry.domain === 'idol_story' ? idolDirectory(id, file === entry.file ? entry.file : '') : {}),
        publication: publication ? { kind: 'authoritative-registry', ownership: publication.ownership }
          : { kind: 'catalog-compatibility', aggregate_file: entry.file } }
      const previous = candidates.get(id)
      if (previous && previous.file !== file) throw Error(`Reading identity collision: ${id}`)
      if (!previous) candidates.set(id, candidate)
    }
  }
  return { candidates: [...candidates.values()].sort((a, b) => a.document_id.localeCompare(b.document_id)), excluded }
}
