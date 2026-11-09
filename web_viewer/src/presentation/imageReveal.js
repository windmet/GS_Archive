// Marks each <img> once it has loaded or failed, so styles/gs-motion.css can keep it transparent
// until then and fade it in instead of letting it paint in strips. Load and error do not bubble,
// so one capturing listener on the document sees every image, including teleported layers. An
// image that failed is marked too: its alt text and any component fallback must stay visible. It also
// gets data-gs-failed, which styles/gs-motion.css turns into a quiet paper-2 block instead of the
// browser's broken-image glyph on a bare background.
export const IMAGE_LOADED_ATTRIBUTE = 'data-gs-loaded'
export const IMAGE_FAILED_ATTRIBUTE = 'data-gs-failed'

function mark(target, failed = false) {
  if (target?.tagName !== 'IMG') return
  // A later successful load (the src changed after an error) clears the failure.
  if (failed) target.setAttribute(IMAGE_FAILED_ATTRIBUTE, '')
  else target.removeAttribute(IMAGE_FAILED_ATTRIBUTE)
  if (!target.hasAttribute(IMAGE_LOADED_ATTRIBUTE)) target.setAttribute(IMAGE_LOADED_ATTRIBUTE, '')
}

export function installImageReveal(root = globalThis.document) {
  if (!root?.addEventListener) return () => {}
  const onLoad = event => mark(event.target)
  const onError = event => mark(event.target, true)
  root.addEventListener('load', onLoad, true)
  root.addEventListener('error', onError, true)
  // Anything already settled before the listener existed (nothing, for the client-rendered app)
  // must not stay hidden.
  for (const image of root.querySelectorAll?.('img') || []) if (image.complete) mark(image)
  return () => {
    root.removeEventListener('load', onLoad, true)
    root.removeEventListener('error', onError, true)
  }
}
