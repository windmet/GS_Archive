<template>
  <div ref="root" class="player-session-shell" data-testid="player-session-shell"><slot /></div>
</template>
<script setup>
import { provide, ref } from 'vue'
import { usePlayerImmersiveMode, createMobileViewingOffer } from '../../composables/usePlayerImmersiveMode.js'
import { PLAYER_SESSION_KEY } from '../../composables/PlayerSession.js'
const root = ref(null)
const immersive = usePlayerImmersiveMode()
const claimOffer = createMobileViewingOffer()
provide(PLAYER_SESSION_KEY, { immersive, enter: () => { claimOffer(); return immersive.enter(root.value) }, claimOffer })
</script>
<style scoped>
.player-session-shell { position: fixed; inset: 0; z-index: 100; background: #000; }
.player-session-shell:fullscreen { width: 100%; height: 100%; }
</style>
