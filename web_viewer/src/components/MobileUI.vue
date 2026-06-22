<template>
  <div class="mobile-ui-overlay">
    <div class="backdrop-mask"></div>

    <div class="mockup-phone">
      <div class="chat-header">{{ chatTitle }}</div>

      <div class="chat-screen" ref="chatScreenRef" :style="{ backgroundImage: `url(${bgUrl})` }">

        <div
          v-for="(msg, i) in historyMessages" :key="i"
          class="msg-row"
          :class="msg.isProducer ? 'row-producer' : 'row-idol'"
        >
          <template v-if="!msg.isProducer">
            <img v-if="msg.charaId" class="chat-avatar" :src="getMobileIconUrl(msg.charaId)" alt="" />
            <div class="msg-body">
              <span class="chat-name">{{ msg.speaker }}</span>
              <img v-if="msg.isStamp" class="chat-stamp" :src="getStampUrl(msg.stampId)" alt="stamp" />
              <div v-else-if="msg.text" class="bubble-idol" v-html="parseEmoji(msg.text)"></div>
            </div>
          </template>
          <template v-else>
            <div v-if="msg.text" class="bubble-producer" v-html="parseEmoji(msg.text)"></div>
            <div class="producer-spacer"></div>
          </template>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { getMobileBgUrl, getMobileIconUrl, getUnitMobileBgUrl, getEmojiUrl, getStampUrl } from '../utils/AssetResolver.js'
import { IDOL_NAME_TO_ID, IDOL_ID_TO_NAME } from '../utils/IdolNameMap.js'
import { UNIT_CODE_TO_NAME, getUnitCodeByCharaId, normalizeUnitCode } from '../utils/UnitNameMap.js'
import { resolveTextContent } from '../utils/TextHelper.js'

const props = defineProps({
  dialogue: { type: Object, default: null },
  step: { type: Object, default: null },
  stepIndex: { type: Number, default: -1 },
  scenarioId: { type: String, default: '' },
  historyStack: { type: Array, default: () => [] },
  choiceTexts: { type: Object, default: () => ({}) },
})

const chatScreenRef = ref(null)

// ── Helpers ──
function isProducer(speaker) {
  if (!speaker) return true
  const p = speaker.replace(/\s/g, '').replace(' ', '').trim()
  return p === '<P>' || p === 'プロデューサー' || p === 'Producer' || p === 'producer'
}

function parseEmoji(text) {
  if (!text) return ''
  return text.replace(/<emoji>(.+?)<\/emoji>/g, (m, id) => `<img src="${getEmojiUrl(id)}" class="inline-emoji" alt="" />`)
}

function cleanSpeaker(raw) {
  return (raw || '').replace(/ /g, ' ').trim()
}

function stepToMessage(step) {
  const d = step.dialogue || {}
  const rawSpeaker = d.speaker || ''
  // If speaker is a raw chara_id like "024shk", resolve to display name
  let speaker = cleanSpeaker(rawSpeaker)
  const charaId = step.chara_id || IDOL_NAME_TO_ID[speaker] || ''
  if (/^\d{3}[a-z0-9]{3}$/.test(speaker)) {
    speaker = IDOL_ID_TO_NAME[speaker] || speaker
  }
  const text = resolveTextContent(d)
  const prod = isProducer(rawSpeaker)
  const stampMatch = text.match(/^<emoji>(image_mobile_stamp_.+?)<\/emoji>$/)
  return { speaker, text, charaId, isProducer: prod, isStamp: !!stampMatch, stampId: stampMatch ? stampMatch[1] : null }
}

// ── Accumulate talk messages as they're encountered ──
// Map<stepIndex, messageObject> — rebuilt from the path
const talkByIndex = ref({})
const _acc = ref(new Set())

watch(() => props.stepIndex, (idx) => {
  const step = props.step
  if (!step || step.type !== 'talk') return
  if (_acc.value.has(idx)) return
  _acc.value = new Set([..._acc.value, idx])
  talkByIndex.value = { ...talkByIndex.value, [idx]: stepToMessage(step) }
  nextTick(scrollToBottom)
}, { immediate: true })

watch(() => props.step, (step) => {
  const idx = props.stepIndex
  if (!step || step.type !== 'talk' || _acc.value.has(idx)) return
  _acc.value = new Set([..._acc.value, idx])
  talkByIndex.value = { ...talkByIndex.value, [idx]: stepToMessage(step) }
  nextTick(scrollToBottom)
})

// ── History: walk the path and merge talk + P-injection messages ──
const historyMessages = computed(() => {
  const msgs = []
  const stack = props.historyStack || []
  const current = props.stepIndex
  if (current < 0) return msgs
  const path = [...stack, current]
  const talkMap = talkByIndex.value

  for (const idx of path) {
    // Inject P's choice text if this index has a saved selection
    const chosenText = props.choiceTexts[idx]
    if (chosenText) {
      msgs.push({ speaker: 'プロデューサー', text: chosenText, charaId: '', isProducer: true, isStamp: false, stampId: null })
    }
    // Add talk message if one exists for this index
    const talk = talkMap[idx]
    if (talk) {
      msgs.push(talk)
    }
  }
  return msgs
})

// ── Resolve unit ──
const unitCodeFromId = computed(() => {
  const sid = props.scenarioId || ''
  const m = sid.match(/8_2_x_(\d{3}[a-z0-9]{3})/)
  if (m) return normalizeUnitCode(m[1])
  for (const msg of historyMessages.value) {
    if (msg.charaId && !msg.isProducer) {
      const code = getUnitCodeByCharaId(msg.charaId)
      if (code) return code
    }
  }
  return null
})

const chatTitle = computed(() => {
  const sid = props.scenarioId || ''
  const isGroup = sid.startsWith('8_2_')
  // Group chat: use unit name
  if (isGroup) {
    const uc = unitCodeFromId.value
    if (uc && UNIT_CODE_TO_NAME[uc]) return UNIT_CODE_TO_NAME[uc]
  }
  // Individual chat: use idol speaker names
  const names = new Set()
  for (const msg of historyMessages.value) {
    if (!msg.isProducer && msg.speaker) names.add(cleanSpeaker(msg.speaker))
  }
  const arr = Array.from(names)
  if (arr.length === 0) return 'トーク'
  if (arr.length === 1) return arr[0]
  if (arr.length === 2) return arr.join('、')
  return arr[0] + ' 他'
})

const bgUrl = computed(() => {
  const uc = unitCodeFromId.value
  return uc ? getUnitMobileBgUrl(uc) : null
})

// ── Auto-scroll when history changes ──
watch(() => historyMessages.value.length, () => {
  nextTick(scrollToBottom)
})

onMounted(() => nextTick(scrollToBottom))

function scrollToBottom() {
  const el = chatScreenRef.value
  if (el) el.scrollTop = el.scrollHeight
}
</script>

<style scoped>
.mobile-ui-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.backdrop-mask {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.mockup-phone {
  position: relative; z-index: 10;
  width: 370px; height: 78vh; max-height: 680px;
  background: #111;
  border-radius: 2.5rem;
  border: 8px solid #222;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  overflow: hidden;
  display: flex; flex-direction: column;
  pointer-events: auto;
}
.chat-header {
  position: relative; z-index: 20;
  background: #0d9488;
  color: #fff;
  text-align: center;
  padding: 14px 16px;
  font-weight: bold;
  font-size: 0.95rem;
  flex-shrink: 0;
}
.chat-screen {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  background-size: cover; background-position: center;
  display: flex; flex-direction: column;
  gap: 12px; padding: 16px 12px 20px;
}
.msg-row { display: flex; width: 100%; }
.row-idol { justify-content: flex-start; }
.row-producer { justify-content: flex-end; }
.msg-body { display: flex; flex-direction: column; max-width: 220px; }
.producer-spacer { width: 36px; flex-shrink: 0; }
.chat-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  margin-right: 8px; margin-top: 14px; align-self: flex-start;
  object-fit: cover; background: #ddd; flex-shrink: 0;
}
.chat-name { font-size: 0.7rem; color: rgba(255,255,255,0.9); margin-left: 4px; margin-bottom: 3px; }
.bubble-idol {
  background: #fff; color: #222;
  padding: 10px 14px; border-radius: 16px; border-bottom-left-radius: 4px;
  font-size: 0.85rem; line-height: 1.6; white-space: pre-wrap;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}
.bubble-producer {
  background: #22c55e; color: #fff;
  padding: 10px 14px; border-radius: 16px; border-bottom-right-radius: 4px;
  font-size: 0.85rem; line-height: 1.6; white-space: pre-wrap;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1); max-width: 220px;
}
.chat-stamp { width: 160px; height: auto; border-radius: 12px; display: block; }
</style>
<style>
.inline-emoji { display: inline-block; width: 22px; height: 22px; vertical-align: middle; margin: 0 1px; }
</style>
