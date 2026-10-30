import { cardArtThumbUrl } from '../../shared/portal/CardArtThumbnails.js'

export function createPortalRepository({bootstrap, client}) {
  return {
    async loadScope(id = 'all', options = {}) {
      const index = await client.load(bootstrap.domains.portal, options)
      const descriptor = index.scopes?.[id]
      if (!descriptor?.sha256 || descriptor.kind !== 'portal.scope') throw Error('Portal scope descriptor missing')
      return client.load({...descriptor,expectedId:id}, {...options, validate(data) {
        if (data.id !== id || data.overview?.scopeId !== (id === 'all' ? '' : id) ||
          data.overview?.projectionVersion !== 2 || data.overview.footprints?.length !== 4)
          throw Error('Portal scope identity or shape mismatch')
      }})
    },
    // 315 岁时记 gasha openings (all-idol scope); null for a release built before the file existed.
    async loadAlmanacGashas(options = {}) {
      const index = await client.load(bootstrap.domains.portal, options)
      const descriptor = index.almanacGashas
      if (!descriptor) return null
      if (!descriptor.sha256 || descriptor.kind !== 'portal.almanac_gashas') throw Error('Almanac gasha descriptor invalid')
      return client.load(descriptor, {...options, validate(data) {
        if (!data?.months || Object.keys(data.months).length !== 12 || !Object.values(data.months).every(Array.isArray))
          throw Error('Almanac gasha shape mismatch')
      }})
    },
  }
}

// A release-pinned Portal scope bakes full-size card-art URLs into its projection.
// The Portal draws thumbnails, so the mapping belongs here rather than in every
// regenerated scope: `full` keeps the pinned URL for the detail page, and a scope
// that already carries thumbnail URLs passes through unchanged (idempotent).
function portalCardArt(image) {
  if (!image || typeof image.url !== 'string') return image
  const thumb = cardArtThumbUrl(image.url)
  return thumb ? {...image, url: thumb, full: image.full || image.url} : image
}

// Names remain optional reactive presentation; the immutable source projection is shared.
export function portalDisplayOverview(source, {idolName, cardTitle} = {}) {
  if (!source) return {loading:true,collections:{},footprints:[]}
  const name = (id, fallback) => idolName?.(id, fallback) || fallback
  const cards = source.collections.cards.map(row => ({...row,
    image: portalCardArt(row.image), landscape: portalCardArt(row.landscape),
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
