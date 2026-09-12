export const READING_SOURCE_FILE = /^(?:episodes\/)?[A-Za-z0-9_-]+\.json$/

/** Catalog-owned discovery; readCompiled is injected so no directory crawl or
 * media loader decides what is published. Missing/invalid inputs stay audited. */
export async function discoverReadingSources({ catalog, publications, readCompiled }) {
  const candidates = new Map(), excluded = []
  const chapters = (catalog.collectionStructure || []).flatMap(section => section.chapters)
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
    for (const file of files) {
      if (!READING_SOURCE_FILE.test(file)) throw Error('Invalid episode source file')
      let source
      try { source = file === entry.file ? parent : await readCompiled(file) } catch (error) { exclude(file, `source-read:${error.code || error.message}`); continue }
      const id = file.replace(/^episodes\//, '').replace(/\.json$/, '')
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
        publication: publication ? { kind: 'authoritative-registry', ownership: publication.ownership }
          : { kind: 'catalog-compatibility', aggregate_file: entry.file } }
      const previous = candidates.get(id)
      if (previous && previous.file !== file) throw Error(`Reading identity collision: ${id}`)
      if (!previous) candidates.set(id, candidate)
    }
  }
  return { candidates: [...candidates.values()].sort((a, b) => a.document_id.localeCompare(b.document_id)), excluded }
}
