/** Share successful/in-flight effect loads; a failed request must be retryable. */
export function loadEffectTexture(cache, name, loadTextureFromUrl) {
  if (!cache[name]) {
    const pending = Promise.resolve()
      .then(() => loadTextureFromUrl(`/data/fx_extracted/unity_${name}.png`))
      .catch(error => {
        if (cache[name] === pending) delete cache[name]
        throw error
      })
    cache[name] = pending
  }
  return cache[name]
}
