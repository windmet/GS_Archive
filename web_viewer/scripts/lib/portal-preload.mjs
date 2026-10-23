// The Portal, a first visit's landing page, reads its index and then the all-idols scope before it can
// request a single unit logo. Both are release-pinned read-model files, so the page preloads them and
// they download alongside the entry script. The index preload comes from the bootstrap
// (archive-bootstrap-plugin); the scope's URL is only in the candidate's Portal index, so the preview
// package adds that one. Pages that never open on the Portal drop both (generate-entity-head-shells).
export const portalPreloadLink = url => `<link rel="preload" href="${url}" as="fetch" crossorigin>`
export const PORTAL_PRELOAD = /[ \t]*<link rel="preload" href="\/_catalog\/v\/[a-f0-9]{64}\/portal\/[a-z0-9/_-]+\.json" as="fetch" crossorigin>\r?\n?/g

export function withPortalScopePreload(html, boot, portalIndex) {
  const index = boot?.domains?.portal?.url, scope = portalIndex?.data?.scopes?.all
  if (portalIndex?.release !== boot?.release || scope?.kind !== 'portal.scope'
    || !new RegExp(`^/_catalog/v/${boot.release}/portal/[a-z0-9/_-]+\\.json$`).test(scope?.url || ''))
    throw new Error('Candidate Portal index lacks the pinned all-idols scope')
  const anchor = portalPreloadLink(index)
  if ((html.match(PORTAL_PRELOAD) || []).length !== 1 || !html.includes(anchor)) throw new Error('index.html must preload exactly the Portal index')
  return html.replace(anchor, `${anchor}\n${portalPreloadLink(scope.url)}`)
}
