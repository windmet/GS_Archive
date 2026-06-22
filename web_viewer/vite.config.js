import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // Ignore massive asset directories from file watcher.
    // The 32K+ voice files and 700+ spine models cause chokidar
    // to hang the dev server on Windows.
    watch: {
      ignored: [
        '**/public/assets/voice/**',
        '**/public/assets/spines/**',
        '**/public/assets/bg/**',
      ],
    },
  },
})
