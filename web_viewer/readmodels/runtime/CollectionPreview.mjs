/** Look up the exact source-bound collection record through the pinned client. */
export async function lookupCollectionEntry(repository, key, options = {}) {
  const match = /^(item|honor):(\d+)$/.exec(key || '');
  if (!match) throw Error('Invalid collection identity');
  const domain = match[1] === 'item' ? 'items' : 'honors';
  const catalog = await repository.catalog(domain, options);
  const row = catalog.find(entry => String(entry.id) === match[2]);
  if (!row) throw Error('Unavailable collection identity');
  const detail = await repository.detail(domain, row, options);
  if (String(detail.entry?.id) !== match[2] || detail.entry?.key !== key)
    throw Error('Collection preview identity mismatch');
  return { key, domain, detail };
}

/** Closing/switching must prevent a late request from restoring an old drawer. */
export function createCollectionPreview(repository, onChange) {
  let revision = 0, controller = null, disposed = false;
  const state = { key: '', domain: '', detail: null, busy: false, error: '' };
  const publish = values => { Object.assign(state, values); if (!disposed) onChange({ ...state }); };
  async function open(key) {
    if (disposed) return false;
    controller?.abort();
    const run = ++revision;
    controller = new AbortController();
    const options = { signal: controller.signal };
    publish({ key, domain: '', detail: null, busy: true, error: '' });
    try {
      const result = await lookupCollectionEntry(repository, key, options);
      if (disposed || run !== revision || options.signal.aborted) return false;
      publish({ ...result, busy: false });
      return true;
    } catch (error) {
      if (!disposed && run === revision && !options.signal.aborted)
        publish({ busy: false, error: '藏品资料暂时无法读取，请重试。' });
      return false;
    }
  }
  function close() {
    revision++;
    controller?.abort();
    publish({ key: '', domain: '', detail: null, busy: false, error: '' });
  }
  return { state, open, close, dispose() { disposed = true; close(); } };
}
