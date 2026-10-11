// Maintainer-only surfaces (raw evidence, engine counters, audit pages) stay out
// of the reader-facing product. `?maintainer=1` turns them on for this browser;
// `?maintainer=0` turns them off. Read on demand so SSR and tests can control it.
const KEY = 'sidem-maintainer'

function storage() {
  try { return globalThis.localStorage || null } catch { return null }
}

export function isMaintainerMode(search = globalThis.location?.search || '') {
  const flag = new URLSearchParams(search).get('maintainer')
  const store = storage()
  try {
    if (flag === '1') store?.setItem(KEY, '1')
    else if (flag === '0') store?.removeItem(KEY)
    else return store?.getItem(KEY) === '1'
  } catch { /* storage unavailable: the URL flag still decides this call */ }
  return flag === '1'
}
