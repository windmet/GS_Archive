/** No startup side effects. One instance per page; one bounded cache for read models.
 * Does NOT replace StoryAssetTransport or CompressedVoiceCache.
 */
export class ReadModelError extends Error {
  constructor(code, message, detail = {}) { super(message); this.name = 'ReadModelError'; this.code = code; Object.assign(this, detail); }
}
const abortError = signal => signal?.reason instanceof Error ? signal.reason : new ReadModelError('CANCELLED', 'Request cancelled');
function waitFor(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(abortError(signal)); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}
export class ReadModelClient {
  constructor({ release, fetchImpl = (...args) => fetch(...args), origin = globalThis.location?.origin || 'https://archive.invalid',
    concurrency = 4, maxEntries = 48, maxRetainedBytes = 6 * 1024 * 1024, timeoutMs = 15000,
    observe = () => {} } = {}) {
    if (!/^[a-f0-9]{64}$/.test(release || '')) throw new TypeError('A pinned release hash is required');
    if (!Number.isInteger(concurrency) || concurrency < 2 || concurrency > 8) throw new TypeError('concurrency must be 2..8');
    Object.assign(this, { release, fetchImpl, origin, concurrency, maxEntries, maxRetainedBytes, timeoutMs, observe });
    this.disposed = false; this.cache = new Map(); this.flights = new Map(); this.queue = []; this.active = 0; this.backgroundActive = 0; this.retainedBytes = 0;
  }
  inspect() { return { entries: this.cache.size, retainedSourceBytes: this.retainedBytes, active: this.active, queued: this.queue.length, flights: this.flights.size }; }
  _url(descriptor) {
    const url = new URL(descriptor.url, this.origin);
    if (url.origin !== this.origin || url.search || url.hash || !url.pathname.startsWith(`/_catalog/v/${this.release}/`)
      || !url.pathname.endsWith('.json')) throw new ReadModelError('BAD_URL', 'Only same-origin pinned read-model URLs are accepted');
    return url.href;
  }
  _note(event) { try { this.observe({ at: Date.now(), ...event }); } catch { /* Diagnostics never own product correctness. */ } }
  async load(descriptor, { signal, priority = 'foreground', validate } = {}) {
    if (this.disposed) throw new ReadModelError('DISPOSED', 'Client disposed');
    if (signal?.aborted) throw abortError(signal);
    const url = this._url(descriptor), key = `${url}|${descriptor.sha256 || ''}`;
    const validateResult = result => {
      if (descriptor.kind && result.kind !== descriptor.kind) throw new ReadModelError('KIND_MISMATCH', url);
      if (descriptor.expectedId !== undefined && String(result.data?.id) !== String(descriptor.expectedId)) throw new ReadModelError('IDENTITY_MISMATCH', url);
      validate?.(result.data); return result.data;
    };
    const cached = this.cache.get(key);
    if (cached) { this.cache.delete(key); this.cache.set(key, cached); return validateResult(cached.value); }
    let flight = this.flights.get(key);
    if (flight?.controller.signal.aborted) { this.flights.delete(key); flight = null; }
    if (!flight) {
      const controller = new AbortController();
      flight = { key, url, descriptor, controller, users: 0, priority: priority === 'background' ? 1 : 0, settled: false, started: false };
      flight.promise = new Promise((resolve, reject) => { Object.assign(flight, { resolve, reject }); });
      // Protect the shared promise if all consumer races have already left.
      flight.promise.catch(() => {});
      this.flights.set(key, flight); this.queue.push(flight);
      this._note({ phase: 'queued', url });
    } else if (priority !== 'background' && !flight.started) flight.priority = 0;
    flight.users++;
    this._pump();
    try { return validateResult(await waitFor(flight.promise, signal)); }
    finally {
      flight.users--;
      if (flight.users === 0 && !flight.settled) {
        flight.controller.abort(new ReadModelError('NO_CONSUMERS', 'Last consumer left'));
        if (!flight.started) {
          this.queue = this.queue.filter(item => item !== flight); flight.settled = true;
          if (this.flights.get(key) === flight) this.flights.delete(key);
          flight.reject(abortError(flight.controller.signal));
        }
      }
    }
  }
  _pump() {
    this.queue.sort((a, b) => a.priority - b.priority);
    while (this.active < this.concurrency && this.queue.length) {
      // At most one speculative request; leave a network slot for user intent.
      const i = this.queue.findIndex(item => item.priority === 0 || (this.backgroundActive === 0 && this.active < this.concurrency - 1));
      if (i < 0) return;
      const flight = this.queue.splice(i, 1)[0];
      if (flight.settled || flight.controller.signal.aborted) continue;
      flight.started = true; this.active++;
      const wasBackground = flight.priority === 1; if (wasBackground) this.backgroundActive++;
      const finish = () => {
        flight.settled = true; this.active--; if (wasBackground) this.backgroundActive--;
        if (this.flights.get(flight.key) === flight) this.flights.delete(flight.key);
        this._pump();
      };
      this._run(flight).then(value => { finish(); flight.resolve(value); }, error => { finish(); flight.reject(error); });
    }
  }
  async _run(flight) {
    const { controller, descriptor, url } = flight;
    // Starts on dispatch, not while waiting for a scheduler slot.
    const timer = setTimeout(() => controller.abort(new ReadModelError('TIMEOUT', 'Read-model body deadline exceeded', { url })), this.timeoutMs);
    const maxBytes = Math.min(descriptor.maxBytes || 768 * 1024, 768 * 1024);
    const operation = async () => {
      this._note({ phase: 'request-start', url });
      const response = await this.fetchImpl(url, { signal: controller.signal, cache: 'default' });
      if (controller.signal.aborted) throw abortError(controller.signal);
      this._note({ phase: 'headers', url, status: response.status });
      if (!response.ok) {
        response.body?.cancel?.().catch(() => {});
        throw new ReadModelError(response.status === 404 ? 'RELEASE_OR_ARTIFACT_MISSING' : `HTTP_${response.status}`, `HTTP ${response.status}`, { status: response.status, url });
      }
      if (!(response.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
        response.body?.cancel?.().catch(() => {}); throw new ReadModelError('MIME', 'Expected JSON, possibly received SPA fallback', { url });
      }
      const chunks = []; let length = 0;
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        const cancel = () => { reader.cancel().catch(() => {}); };
        controller.signal.addEventListener('abort', cancel, { once: true });
        try {
          while (true) {
            const part = await waitFor(reader.read(), controller.signal); if (part.done) break;
            length += part.value.byteLength;
            if (length > maxBytes) { await reader.cancel(); throw new ReadModelError('BODY_BUDGET', 'Decoded payload too large', { url, length }); }
            chunks.push(part.value);
          }
        } finally { controller.signal.removeEventListener('abort', cancel); reader.releaseLock(); }
      } else {
        const bytes = new Uint8Array(await waitFor(response.arrayBuffer(), controller.signal)); length = bytes.length;
        if (length > maxBytes) throw new ReadModelError('BODY_BUDGET', 'Decoded payload too large', { url, length });
        chunks.push(bytes);
      }
      if (controller.signal.aborted) throw abortError(controller.signal);
      const bytes = new Uint8Array(length); let offset = 0;
      for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
      this._note({ phase: 'body-end', url, decodedBytes: length });
      if (descriptor.sha256) {
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
        if (hash !== descriptor.sha256) throw new ReadModelError('HASH', 'Read-model hash mismatch', { url });
      }
      const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (value.schema_version !== 1 || value.release !== this.release || typeof value.kind !== 'string' || !Object.hasOwn(value, 'data'))
        throw new ReadModelError('SCHEMA', 'Read-model envelope mismatch', { url });
      if (descriptor.kind && value.kind !== descriptor.kind) throw new ReadModelError('KIND_MISMATCH', url);
      if (controller.signal.aborted) throw abortError(controller.signal);
      this._note({ phase: 'parse-end', url });
      this._remember(flight.key, value, length); return value;
    };
    try { return await waitFor(operation(), controller.signal); }
    catch (error) { this._note({ phase: 'error', url, code: error.code || error.name }); throw error; }
    finally { clearTimeout(timer); }
  }
  _remember(key, value, bytes) {
    if (bytes > this.maxRetainedBytes || this.maxEntries < 1) return;
    const old = this.cache.get(key); if (old) this.retainedBytes -= old.bytes;
    this.cache.delete(key); this.cache.set(key, { value, bytes }); this.retainedBytes += bytes;
    while (this.cache.size > this.maxEntries || this.retainedBytes > this.maxRetainedBytes) {
      const first = this.cache.keys().next().value;
      this.retainedBytes -= this.cache.get(first).bytes; this.cache.delete(first);
    }
  }
  invalidate(descriptor) {
    const url = this._url(descriptor), key = `${url}|${descriptor.sha256 || ''}`, old = this.cache.get(key);
    if (old) { this.retainedBytes -= old.bytes; this.cache.delete(key); }
  }
  dispose() {
    this.disposed = true;
    for (const flight of this.flights.values()) flight.controller.abort(new ReadModelError('DISPOSED', 'Client disposed'));
    for (const flight of this.queue) { flight.settled = true; flight.reject(abortError(flight.controller.signal)); }
    this.queue = []; this.flights.clear(); this.cache.clear(); this.retainedBytes = 0;
  }
}
export async function entityDescriptor(bootstrap, domain, id, kind) {
  if (!/^[a-z-]+$/.test(domain)) throw new TypeError('Invalid domain');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(id))))]
    .map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return { url: `/_catalog/v/${bootstrap.release}/${domain}/detail/${hash}.json`, kind, expectedId: String(id), maxBytes: 768 * 1024 };
}
