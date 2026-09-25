/** Use inside existing r2-resource.js without replacing its gzip/Range/304 validation.
 * On unconditional GET, R2.get already returns metadata. No preceding head is needed.
 */
export async function readMetadataOrFullObject(bucket, objectKey, request) {
  const full = request.method === 'GET' && !['Range','If-Range','If-None-Match','If-Modified-Since','If-Match','If-Unmodified-Since'].some(h => request.headers.has(h));
  const object = full ? await bucket.get(objectKey) : null;
  const metadata = full ? object : await bucket.head(objectKey);
  return { metadata, object, full,
    discard: async () => { if (object?.body) { try { await object.body.cancel(); } catch { /* Already consumed/closed. */ } } } };
}
// Integration:
// const fetched = await readMetadataOrFullObject(bucket, objectKey, request)
// const meta = fetched.metadata
// ... keep all current metadata, gzip negotiation, HEAD, ETag and Range code ...
// Before a metadata-validation error return: await fetched.discard()
// const object = fetched.full ? fetched.object : await bucket.get(objectKey, originalRangeOptions)
// ... use existing Response with manual encoding when its body is already gzip ...
