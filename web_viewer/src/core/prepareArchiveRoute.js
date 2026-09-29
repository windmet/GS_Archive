/** Fetch route data and its component together; publish only after both settle. */
export async function prepareArchiveRoute(loaders, view, data) {
  const [, result] = await Promise.all([loaders[view]?.(), data])
  return result
}
