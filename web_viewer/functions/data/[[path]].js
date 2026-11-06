import { serveR2Resource } from '../_shared/r2-resource.js'

const SEASONAL_READING_RELEASE = 'seasonal-reading-v1'
export const SEASONAL_READING_PATH = /^\/data\/reading\/5_0[12]_[A-Za-z0-9_]+\.json$/
// Work stories used to be redirected to a /_work-backfill/ copy in the Pages package. The data
// (d049f4fa) and compiled (4afb61ee) snapshots have held the same 637 documents, stories and manifests
// byte for byte since 2026-10-31, so they are served from R2 like every other Reader document.

export const onRequest = context => {
  const { request, env } = context
  const pathname = new URL(request.url).pathname
  if (env.ARCHIVE_SEASONAL_READING_RELEASE === SEASONAL_READING_RELEASE &&
      (request.method === 'GET' || request.method === 'HEAD') && SEASONAL_READING_PATH.test(pathname)) {
    return Response.redirect(new URL(`/_seasonal-reading${pathname}`, request.url), 302)
  }
  return serveR2Resource({ ...context, prefix: 'data' })
}
