import { onBeforeUnmount, ref, watch } from 'vue'

// True once `target` comes within `margin` of the viewport, and stays true. Images whose src is bound through it
// make no request before then. Native loading="lazy" was not enough on the Portal: Chrome starts lazy images
// 1250–2500 px ahead, which covers every phone-only below-the-fold card (docs/GS_ARCHIVE_PORTAL_IMAGE_BUDGET_20261013.md).
// Without IntersectionObserver (SSR, old browsers), or when `eagerMedia` matches (a layout where the target is on
// the first screen), it is true from the start: waiting for the observer's first callback there delays the request
// and measurably worsened desktop LCP.
export function useNearViewport(target, { margin = '200px', eagerMedia = '' } = {}) {
  const near = ref(typeof IntersectionObserver === 'undefined' || (!!eagerMedia && typeof matchMedia === 'function' && matchMedia(eagerMedia).matches))
  let observer = null
  const stop = () => { observer?.disconnect(); observer = null }
  watch(target, element => {
    stop()
    if (near.value || !element) return
    observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      near.value = true
      stop()
    }, { rootMargin: margin })
    observer.observe(element)
  }, { flush: 'post', immediate: true })
  onBeforeUnmount(stop)
  return near
}
