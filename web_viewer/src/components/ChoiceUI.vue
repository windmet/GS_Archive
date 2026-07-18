<template>
  <div class="choice-ui">
    <div class="choice-prompt" v-if="prompt">{{ prompt }}</div>
    <div class="choice-options">
      <button
        v-for="(opt, i) in options"
        :key="i"
        class="choice-btn"
        @click.stop="select(opt, i)"
      >
        <span class="choice-num">{{ i + 1 }}</span>
        <span class="choice-text">{{ opt.text || opt.detail || opt.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  step: { type: Object, default: null },
})
const emit = defineEmits(['select'])

const options = computed(() => props.step?.options || [])
const prompt = computed(() => props.step?.dialogue?.text || null)

function select(opt, index) {
  emit('select', { ...opt, index })
}
</script>

<style scoped>
.choice-ui {
  position: absolute;
  top: 48px; left: 0; right: 0; bottom: 56px;
  display: flex; flex-direction: column;
  justify-content: flex-end;
  padding: 32px;
  pointer-events: none;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}
.choice-prompt {
  color: rgba(255,255,255,0.9);
  font-size: 0.9rem;
  margin-bottom: 16px;
  text-align: center;
  text-shadow: 0 1px 4px rgba(0,0,0,0.6);
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  padding: 12px 20px;
  border-radius: 12px;
}
.choice-options {
  display: flex; flex-direction: column; gap: 10px;
  pointer-events: auto;
}
.choice-btn {
  display: flex; align-items: center; gap: 12px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 16px 20px;
  cursor: pointer;
  text-align: left;
  font-size: 0.95rem;
  line-height: 1.5;
  transition: background 0.2s, border-color 0.2s, transform 0.1s;
  box-shadow: 0 2px 12px rgba(0,0,0,0.2);
}
.choice-btn:hover {
  background: rgba(13, 148, 136, 0.75);
  border-color: rgba(13, 148, 136, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(13, 148, 136, 0.25);
}
.choice-num {
  flex-shrink: 0;
  width: 30px; height: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.7);
}
.choice-btn:hover .choice-num {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
.choice-text {
  flex: 1;
}
</style>
