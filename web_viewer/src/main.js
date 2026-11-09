import { createApp } from 'vue'
import App from './App.vue'
import { installImageReveal } from './presentation/imageReveal.js'
import './styles/GS_UI_TOKENS.css'
import './styles/gs-motion.css'
import './styles/player-tokens.css'
import './styles/player-motion.css'

// index.html's inline guard owns window.__gsBoot (stage marks and the diagnostic panel); absent in tests.
const boot = window.__gsBoot
boot?.mark('entry')
installImageReveal()
const app = createApp(App)
// Vue swallows render/lifecycle errors into its own warning. Keep that log, and until the first route is ready also
// hand the error to the guard so its panel can show it; afterwards a broken component is not a boot failure.
app.config.errorHandler = (error, instance, info) => {
  console.error('[Vue]', info, error)
  if (boot && boot.state().stage !== 'ready') boot.fail(error)
}
try {
  app.mount('#app')
} catch (error) {
  boot?.fail(error)
  throw error
}
boot?.mark('mounted')
