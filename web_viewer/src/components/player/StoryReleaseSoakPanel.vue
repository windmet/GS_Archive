<template>
  <aside class="soak-panel" data-testid="story-soak-panel">
    <header>
      <strong>P2-B SOAK</strong>
      <span :data-status="status.status">{{ status.status }} · {{ status.sample_count }}</span>
    </header>
    <div class="soak-actions">
      <button data-testid="story-soak-start" @click="start">START</button>
      <button data-testid="story-soak-quiet" @click="quiet">QUIET ENDPOINT</button>
      <button data-testid="story-soak-stop" @click="stop">STOP</button>
      <button data-testid="story-soak-export" @click="exportReport">EXPORT</button>
    </div>
    <textarea
      v-if="report"
      data-testid="story-release-soak-export"
      :value="report"
      readonly
      aria-label="Story release soak report"
    />
  </aside>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { releaseSoakRecorder } from '../../core/story-runtime/ReleaseSoakRecorder.js'
import { storyReleaseProbe } from '../../core/story-runtime/StoryReleaseProbe.js'

const status = ref(releaseSoakRecorder.inspect())
const report = ref('')
let refreshTimer = null

function refresh() {
  status.value = releaseSoakRecorder.inspect()
}

function start() {
  report.value = ''
  releaseSoakRecorder.start()
  refresh()
}

function quiet() {
  releaseSoakRecorder.record('quiet-endpoint')
  refresh()
}

function stop() {
  releaseSoakRecorder.stop()
  refresh()
}

function exportReport() {
  report.value = JSON.stringify(releaseSoakRecorder.export(), null, 2)
}

onMounted(() => {
  releaseSoakRecorder.attachCollector(() => storyReleaseProbe.collectSnapshot())
  refreshTimer = setInterval(refresh, 2000)
})

onBeforeUnmount(() => {
  if (refreshTimer != null) clearInterval(refreshTimer)
  refreshTimer = null
  releaseSoakRecorder.detachCollector()
})
</script>

<style scoped>
.soak-panel {
  position: fixed;
  z-index: 10020;
  top: 8px;
  right: 8px;
  width: min(420px, calc(100vw - 16px));
  padding: 8px;
  color: #eaf7ff;
  background: rgba(5, 16, 25, .94);
  border: 1px solid rgba(91, 202, 255, .65);
  border-radius: 7px;
  font: 11px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace;
  box-shadow: 0 8px 28px rgba(0, 0, 0, .38);
}

.soak-panel header,
.soak-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.soak-panel header {
  justify-content: space-between;
  margin-bottom: 6px;
}

.soak-actions {
  flex-wrap: wrap;
}

button {
  padding: 4px 7px;
  color: inherit;
  background: #17364a;
  border: 1px solid #3c7899;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
}

button:hover { background: #20506d; }

textarea {
  display: block;
  width: 100%;
  height: 150px;
  margin-top: 7px;
  color: #dff4ff;
  background: #07121a;
  border: 1px solid #31566b;
  resize: vertical;
  font: inherit;
}
</style>
