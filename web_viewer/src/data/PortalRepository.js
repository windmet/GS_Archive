export function createPortalRepository({bootstrap, client}) {
  return {
    async loadScope(id = 'all', options = {}) {
      const index = await client.load(bootstrap.domains.portal, options)
      const descriptor = index.scopes?.[id]
      if (!descriptor?.sha256 || descriptor.kind !== 'portal.scope') throw Error('Portal scope descriptor missing')
      return client.load({...descriptor,expectedId:id}, {...options, validate(data) {
        if (data.id !== id || data.overview?.scopeId !== (id === 'all' ? '' : id) ||
          data.overview?.projectionVersion !== 1 || data.overview.footprints?.length !== 4)
          throw Error('Portal scope identity or shape mismatch')
      }})
    },
  }
}

// Names remain optional reactive presentation; the immutable source projection is shared.
export function portalDisplayOverview(source, {idolName, cardTitle} = {}) {
  if (!source) return {loading:true,collections:{},footprints:[]}
  const name = (id, fallback) => idolName?.(id, fallback) || fallback
  const cards = source.collections.cards.map(row => ({...row,
    title:cardTitle?.(row.title) || row.title,idolName:name(row.idolCode,row.idolName)}))
  const songs = source.collections.songs.map(row => ({...row,
    performers:row.performers.map(person => ({...person,name:name(person.id,person.name)}))}))
  const stories = source.collections.stories.map(row => ({...row,
    cast:row.cast.map(person => ({...person,name:name(person.id,person.name)}))}))
  return {...source,collections:{...source.collections,cards,songs,stories},
    cards:cards.slice(0,3),
    songs:source.scopeId ? songs : songs.slice(0,4),
    stories:stories.slice(0,4),
    units:source.units.map(row => ({...row,members:row.members.map(person =>
      ({...person,name:name(person.id,person.name)}))}))}
}
