export function usePhotoCatalogNavigation({ view, currentPhotoIdol, currentPhotoEntity, filterQuery,
  syncArchiveRoute, captureDetailSource, commitView }) {
  function selectPhotoIdol(id) {
    if (!/^\d{1,4}$/.test(String(id))) return
    if (currentPhotoIdol.value!==String(id) && /^(faces|poses):/.test(currentPhotoEntity.value)) currentPhotoEntity.value=''
    currentPhotoIdol.value=String(id); syncArchiveRoute({restoreView:false})
  }

  function updatePhotoCatalogQuery(query) {
    filterQuery.value=query
    syncArchiveRoute({replace:true,restoreView:false})
  }

  function selectPhotoEntity(key) {
    if (key === '' && view.value === 'photo_catalog') {
      currentPhotoEntity.value = ''; syncArchiveRoute({ replace: true, restoreView: false }); return
    }
    if (!/^(spots|scenes|faces|poses|stickers|frames|filters):\d+$/.test(key || '')) return
    currentPhotoEntity.value=key; syncArchiveRoute({replace:true,restoreView:false})
  }
  function openPictureStudio(key) {
    if (key) selectPhotoEntity(key); captureDetailSource(); filterQuery.value=''; commitView('picture_studio')
  }
  return { selectPhotoIdol, updatePhotoCatalogQuery, selectPhotoEntity, openPictureStudio }
}
