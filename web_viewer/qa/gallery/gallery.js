import { createApp, h } from 'vue'
import '/src/styles/GS_UI_TOKENS.css'
import { SCENES } from './scenes.js'

const root = document.getElementById('app')
const id = new URLSearchParams(location.search).get('scene')
const scene = SCENES[id]

if (!scene) {
  root.innerHTML = `<nav class="gallery-index"><h1>页面画廊</h1>${Object.entries(SCENES)
    .map(([key, { label }]) => `<a href="?scene=${key}">${label}</a>`).join('')}</nav>`
  document.documentElement.dataset.galleryState = 'index'
} else {
  try {
    const { component, props } = await scene.mount()
    createApp({ render: () => h(component, props) }).mount(root)
    document.title = scene.label
    document.documentElement.dataset.galleryState = 'ready'
  } catch (error) {
    root.textContent = `${scene.label}: ${error.message}`
    document.documentElement.dataset.galleryState = 'failed'
    throw error
  }
}
