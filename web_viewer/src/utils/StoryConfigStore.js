import { storyAssetTransport } from '../core/StoryAssetTransport.js'
import { withLoadDeadline } from '../core/AsyncLoadBoundary.js'
import { validateStoryConfig } from './StoryConfigShape.js'

/** One successful parsed configuration per store. Transport shares byte flights;
 * a failed or cancelled consumer never installs a permanent empty success. */
export function createStoryConfigStore({ kind, url, project = value => value,
  transport = storyAssetTransport, timeoutMs = 15000 }) {
  let cached = null
  return {
    peek: () => cached,
    async load({ signal } = {}) {
      signal?.throwIfAborted()
      if (cached !== null) return cached
      const value = await withLoadDeadline(async taskSignal => {
        const data = await transport.getJson(typeof url === 'function' ? url() : url,
          { signal: taskSignal, cache: 'default' })
        taskSignal.throwIfAborted()
        validateStoryConfig(kind, data)
        return project(data)
      }, { signal, timeoutMs, label: `stage-config:${kind}` })
      signal?.throwIfAborted()
      cached = value
      return cached
    },
  }
}
