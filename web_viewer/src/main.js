import { createApp } from 'vue'
import App from './App.vue'
import { installImageReveal } from './presentation/imageReveal.js'
import './styles/GS_UI_TOKENS.css'
import './styles/gs-motion.css'
import './styles/player-tokens.css'
import './styles/player-motion.css'

installImageReveal()

// EXPERIMENT (L4 arm B+, branch claude/portal-ssg-experiment-20261013, not for merge): a prerendered page keeps
// its static markup visible while the app mounts into a hidden sibling; once the app shows the same entity
// (or after a cap), the static markup is removed in one step, so the content never blanks.
const host = document.getElementById('app')
if (host?.hasAttribute('data-prerendered') && window.__GS_SWAP_MODE__ !== 'replace') {
  // The entity's own primary content, not a relation that may render later (e.g. idol-unit waits for unit data).
  const marker = host.querySelector('[data-archive-focus-id^="idol-domain:"]') || host.querySelector('.unit-members')
  const selector = marker?.matches('.unit-members') ? '.unit-members .archive-idol-reference'
    : marker ? `[data-archive-focus-id="${CSS.escape(marker.getAttribute('data-archive-focus-id'))}"]` : ''
  const live = document.createElement('div')
  live.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;overflow:hidden'
  host.after(live)
  createApp(App).mount(live)
  let done = false
  const swap = () => {
    if (done) return
    done = true
    observer.disconnect()
    host.remove()
    live.removeAttribute('style')
    live.id = 'app'
  }
  const observer = new MutationObserver(() => { if (selector && live.querySelector(selector)) swap() })
  observer.observe(live, { childList: true, subtree: true })
  setTimeout(swap, 8000)
} else {
  createApp(App).mount('#app')
}
