import { serveR2Resource } from '../_shared/r2-resource.js'

const WORK_RELEASE = '2026-09-28-story-work-text-backfill-001'
const WORK_PATH = /^\/data\/(?:compiled\/|reading\/)1_5_[A-Za-z0-9_]+\.json$/
const WORK_INDEX = new Set([
  '/data/reading/manifest.json',
  '/data/authoritative_story_publications.json',
  '/data/publication/manifest.json',
  `/data/publication/releases/${WORK_RELEASE}.json`,
])

export const onRequest = context => {
  const { request, env } = context
  const pathname = new URL(request.url).pathname
  if (env.ARCHIVE_WORK_BACKFILL_RELEASE === WORK_RELEASE &&
      (request.method === 'GET' || request.method === 'HEAD') &&
      (WORK_PATH.test(pathname) || WORK_INDEX.has(pathname))) {
    return Response.redirect(new URL(`/_work-backfill${pathname}`, request.url), 302)
  }
  return serveR2Resource({ ...context, prefix: 'data' })
}
