<template>
  <!-- The client's gasha screen art: the key visual with its title logo, or, for pools without one, the list banner
       softened behind the logo. Fills the frame its parent sizes. -->
  <span class="gasha-art" :class="{ 'has-bg': art.bg }">
    <img v-if="art.bg" class="gasha-art-bg" :src="art.bg.url" :width="art.bg.width" :height="art.bg.height" alt="" :loading="loading" decoding="async" />
    <img v-else-if="art.banner" class="gasha-art-backdrop" :src="art.banner.url" alt="" :loading="loading" decoding="async" />
    <img v-if="art.logo" class="gasha-art-logo" :src="art.logo.url" :width="art.logo.width" :height="art.logo.height" :alt="alt" :loading="loading" decoding="async" />
  </span>
</template>

<script setup>
defineProps({
  art: { type: Object, required: true },
  alt: { type: String, default: '' },
  loading: { type: String, default: 'lazy' },
})
</script>

<style scoped>
.gasha-art { position: relative; display: block; width: 100%; height: 100%; overflow: hidden; background: var(--gs-surface); }
.gasha-art-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
/* The 200x100 list banner is too small to show sharp at this size; it only sets the colour. */
.gasha-art-backdrop { position: absolute; inset: -12%; width: 124%; height: 124%; object-fit: cover; filter: blur(14px) saturate(1.1); opacity: .85; }
.gasha-art-logo { position: absolute; left: 50%; top: 50%; width: auto; height: 82%; max-width: 92%; object-fit: contain; transform: translate(-50%, -50%); filter: drop-shadow(0 2px 6px rgb(0 0 0 / .18)); }
/* Over the key visual the logo sits in the corner, as on the gasha screen. */
.has-bg .gasha-art-logo { left: 3%; top: auto; bottom: 3%; height: 46%; max-width: 46%; transform: none; }
</style>
