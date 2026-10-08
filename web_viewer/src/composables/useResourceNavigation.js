export function useResourceNavigation({
  resourceReadModelDetail, resourceReadModelStatus, view, loading,
  detailSourceRoute, filterQuery, currentStoryDomain, currentEventScope,
  currentStoryAvailability, currentStorySort, navigation, archiveBootstrap,
  readModelClient, prepareArchivePage, commitView,
}) {
  let pendingResourceNavigation = 0

  function openArchiveStatus() {
    const request = ++pendingResourceNavigation
    navigation.invalidate()
    const revision = navigation.getRevision()
    resourceReadModelStatus.value = '正在读取资源状态…'
    loading.value = true
    return prepareArchivePage('archive_status', loadResourceStatus()).then(detail => {
      if (request !== pendingResourceNavigation || revision !== navigation.getRevision() || navigation.isDisposed()) return
      resourceReadModelDetail.value = detail
      resourceReadModelStatus.value = ''
      if (view.value !== 'portal') detailSourceRoute.value = ''
      filterQuery.value = ''
      currentStoryDomain.value = ''
      currentEventScope.value = 'all'
      currentStoryAvailability.value = 'all'
      currentStorySort.value = 'domain'
      commitView('archive_status')
    }).catch(error => {
      if (request !== pendingResourceNavigation || revision !== navigation.getRevision()) return
      loading.value = false
      console.error('[ResourceReadModel] Failed to open status:', error)
      resourceReadModelStatus.value = '资源状态暂时无法读取，请重试。'
    })
  }

  async function loadResourceStatus(options = navigation.getLoadOptions?.() || {}) {
    return (async () => {
        const index = await readModelClient.load(archiveBootstrap.domains.resources, options)
        if (index.count !== 1 || index.pages?.length !== 1) throw new Error('Resource status directory mismatch')
        const page = await readModelClient.load(index.pages[0], options)
        const row = page.rows?.[0]
        if (row?.id !== 'archive-status' || !row.detail) throw new Error('Resource status identity mismatch')
        return readModelClient.load({...row.detail,expectedId: row.id}, { ...options, expectedId: row.id, validate: data => {
          if (!data.view?.manifest?.coverage || !data.view?.verification?.scenarios ||
            !data.view?.uiAssets?.meta) throw new Error('Resource status shape mismatch')
        } })
    })()
  }

  function invalidateResourceNavigation() { ++pendingResourceNavigation }

  return { openArchiveStatus, loadResourceStatus, invalidateResourceNavigation }
}
