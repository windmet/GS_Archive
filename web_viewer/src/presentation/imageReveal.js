// Marks each <img> once it has loaded or failed, so styles/gs-motion.css can keep it transparent
// until then and fade it in instead of letting it paint in strips. Load and error do not bubble,
// so one capturing listener on the document sees every image, including teleported layers. An
// image that failed is marked too: its alt text and any component fallback must stay visible.
export const IMAGE_LOADED_ATTRIBUTE = 'data-gs-loaded'

function mark(target) {
  if (target?.tagName === 'IMG' && !target.hasAttribute(IMAGE_LOADED_ATTRIBUTE)) target.setAttribute(IMAGE_LOADED_ATTRIBUTE, '')
}

export function installImageReveal(root = globalThis.document) {
  if (!root?.addEventListener) return () => {}
  const onSettled = event => mark(event.target)
  root.addEventListener('load', onSettled, true)
  root.addEventListener('error', onSettled, true)
  // Anything already settled before the listener existed (nothing, for the client-rendered app)
  // must not stay hidden.
  for (const image of root.querySelectorAll?.('img') || []) if (image.complete) mark(image)
  return () => {
    root.removeEventListener('load', onSettled, true)
    root.removeEventListener('error', onSettled, true)
  }
}
