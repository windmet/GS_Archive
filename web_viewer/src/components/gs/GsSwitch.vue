<template>
  <button type="button" role="switch" class="gs-switch" :class="{ 'on-dark': onDark }" :aria-checked="modelValue" :aria-label="ariaLabel" :disabled="disabled" @click="emit('update:modelValue', !modelValue)"><span class="gs-switch-knob" aria-hidden="true"></span></button>
</template>
<script setup>
// On/off preference. Mint when on because "on" is something currently happening. The control
// carries no text, so every use passes an aria-label.
defineProps({ modelValue: Boolean, ariaLabel: { type: String, required: true }, disabled: Boolean, onDark: Boolean })
const emit = defineEmits(['update:modelValue'])
</script>
<style scoped>
.gs-switch { position: relative; flex: none; width: 40px; height: 24px; padding: 0; border: 0; border-radius: var(--gs-radius-pill); background: var(--gs-switch-off); cursor: pointer; transition: background-color var(--gs-motion-feedback); }
.gs-switch[aria-checked=true] { background: var(--gs-switch-on); }
.gs-switch-knob { position: absolute; top: var(--gs-space-1); left: var(--gs-space-1); width: 20px; height: 20px; border-radius: 50%; background: var(--gs-surface); box-shadow: var(--gs-shadow-1); transition: transform var(--gs-current-motion); }
.gs-switch[aria-checked=true] .gs-switch-knob { transform: translateX(16px); }
.gs-switch:disabled { opacity: .5; cursor: default; }
.gs-switch:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
/* The 40x24 track is the visual; the touch target grows around it without moving neighbours. */
.gs-switch::after { content: ""; position: absolute; inset: -10px -4px; }
.gs-switch.on-dark:not([aria-checked=true]) { background: var(--gs-stage-thumb); }
@media (prefers-reduced-motion: reduce) { .gs-switch, .gs-switch-knob { transition: none; } }
</style>
