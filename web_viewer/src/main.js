import { createApp } from 'vue'
import App from './App.vue'
import { installImageReveal } from './presentation/imageReveal.js'
import './styles/GS_UI_TOKENS.css'
import './styles/gs-motion.css'
import './styles/player-tokens.css'
import './styles/player-motion.css'

installImageReveal()
createApp(App).mount('#app')
