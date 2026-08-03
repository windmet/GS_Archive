<template>
  <div class="msg-row" :class="message.isProducer ? 'row-producer' : 'row-idol'">
    <template v-if="!message.isProducer">
      <img
        v-if="message.charaId && !avatarFailed"
        class="chat-avatar"
        :src="getMobileIconUrl(message.charaId)"
        alt=""
        @error="avatarFailed = true"
      />
      <span v-else class="chat-avatar chat-avatar-placeholder" aria-hidden="true"></span>
      <div class="msg-body">
        <span v-if="message.speaker" class="chat-name">{{ message.speaker }}</span>
        <img
          v-if="message.isStamp && !stampFailed"
          class="chat-stamp"
          :src="getStampUrl(message.stampId)"
          alt="スタンプ"
          @error="stampFailed = true"
        />
        <span v-else-if="message.isStamp" class="chat-stamp-fallback" role="img" aria-label="スタンプ">STAMP</span>
        <LocalizedTextBlock v-else-if="message.display" class="bubble-idol" :display="message.display">
          <template #primary="{ text }">
            <template v-for="(part, partIndex) in messageParts(text)" :key="`primary-${partIndex}`">
              <span v-if="part.type === 'text'">{{ part.text }}</span>
              <img v-else-if="!emojiFailed(part.id)" class="inline-emoji" :src="getEmojiUrl(part.id)" alt="" @error="markEmojiFailed(part.id)" />
              <span v-else class="inline-emoji inline-emoji-fallback" aria-hidden="true">◆</span>
            </template>
          </template>
          <template #secondary="{ text }">
            <template v-for="(part, partIndex) in messageParts(text)" :key="`secondary-${partIndex}`">
              <span v-if="part.type === 'text'">{{ part.text }}</span>
              <img v-else-if="!emojiFailed(part.id)" class="inline-emoji" :src="getEmojiUrl(part.id)" alt="" @error="markEmojiFailed(part.id)" />
              <span v-else class="inline-emoji inline-emoji-fallback" aria-hidden="true">◆</span>
            </template>
          </template>
        </LocalizedTextBlock>
      </div>
    </template>
    <template v-else>
      <LocalizedTextBlock v-if="message.display" class="bubble-producer" :display="message.display">
        <template #primary="{ text }">
          <template v-for="(part, partIndex) in messageParts(text)" :key="`primary-${partIndex}`">
            <span v-if="part.type === 'text'">{{ part.text }}</span>
            <img v-else-if="!emojiFailed(part.id)" class="inline-emoji" :src="getEmojiUrl(part.id)" alt="" @error="markEmojiFailed(part.id)" />
            <span v-else class="inline-emoji inline-emoji-fallback" aria-hidden="true">◆</span>
          </template>
        </template>
        <template #secondary="{ text }">
          <template v-for="(part, partIndex) in messageParts(text)" :key="`secondary-${partIndex}`">
            <span v-if="part.type === 'text'">{{ part.text }}</span>
            <img v-else-if="!emojiFailed(part.id)" class="inline-emoji" :src="getEmojiUrl(part.id)" alt="" @error="markEmojiFailed(part.id)" />
            <span v-else class="inline-emoji inline-emoji-fallback" aria-hidden="true">◆</span>
          </template>
        </template>
      </LocalizedTextBlock>
      <div class="producer-spacer"></div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import LocalizedTextBlock from '../LocalizedTextBlock.vue'
import { getEmojiUrl, getMobileIconUrl, getStampUrl } from '../../utils/AssetResolver.js'

const props = defineProps({
  message: { type: Object, required: true },
})

const avatarFailed = ref(false)
const stampFailed = ref(false)
const failedEmojiIds = ref(new Set())

watch(
  () => [props.message.charaId, props.message.stampId],
  () => {
    avatarFailed.value = false
    stampFailed.value = false
    failedEmojiIds.value = new Set()
  },
)

function emojiFailed(id) {
  return failedEmojiIds.value.has(id)
}

function markEmojiFailed(id) {
  failedEmojiIds.value = new Set([...failedEmojiIds.value, id])
}

function messageParts(text) {
  const value = typeof text === 'string' ? text : ''
  const parts = []
  const pattern = /<emoji>(.+?)<\/emoji>/g
  let cursor = 0
  let match
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) parts.push({ type: 'text', text: value.slice(cursor, match.index) })
    if (/^[A-Za-z0-9._-]+$/.test(match[1])) parts.push({ type: 'emoji', id: match[1] })
    else parts.push({ type: 'text', text: match[0] })
    cursor = match.index + match[0].length
  }
  if (cursor < value.length) parts.push({ type: 'text', text: value.slice(cursor) })
  return parts
}
</script>

<style scoped>
.msg-row { display: flex; width: 100%; }
.row-idol { justify-content: flex-start; }
.row-producer { justify-content: flex-end; }

.msg-body {
  display: flex;
  flex-direction: column;
  max-width: 70%;
}

.producer-spacer { width: 36px; flex-shrink: 0; }

.chat-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  margin-right: 8px;
  margin-top: 16px;
  align-self: flex-start;
  object-fit: cover;
  background: #ddd;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.9);
}

.chat-avatar-placeholder {
  position: relative;
  overflow: hidden;
  background: linear-gradient(150deg, #d8dddf, #aeb8bc);
}

.chat-avatar-placeholder::before,
.chat-avatar-placeholder::after {
  position: absolute;
  left: 50%;
  content: '';
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.72);
}

.chat-avatar-placeholder::before {
  top: 21%;
  width: 34%;
  aspect-ratio: 1;
  border-radius: 50%;
}

.chat-avatar-placeholder::after {
  bottom: -12%;
  width: 72%;
  height: 48%;
  border-radius: 50% 50% 0 0;
}

.chat-name {
  font-size: 0.72rem;
  color: #526174;
  align-self: flex-start;
  /* Translucent label keeps names readable over dark unit backgrounds */
  background: rgba(244, 247, 247, 0.78);
  padding: 1px 8px;
  border-radius: 999px;
  margin-left: 4px;
  margin-bottom: 4px;
}

.bubble-idol {
  background: #ffffff;
  color: var(--player-ink-900);
  padding: 11px 14px;
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  font-size: 0.86rem;
  line-height: 1.6;
  white-space: pre-wrap;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  --localized-primary-line-height: 1.6;
  --localized-secondary-color: #5b6770;
  --localized-secondary-size: 0.82em;
  --localized-secondary-gap: 0.2em;
}

.bubble-producer {
  background: #167a43;
  color: #fff;
  padding: 11px 14px;
  border-radius: 16px;
  border-bottom-right-radius: 4px;
  font-size: 0.86rem;
  line-height: 1.6;
  white-space: pre-wrap;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14);
  max-width: 70%;
  --localized-primary-line-height: 1.6;
  --localized-secondary-color: rgba(255, 255, 255, 0.78);
  --localized-secondary-size: 0.82em;
  --localized-secondary-gap: 0.2em;
}

.chat-stamp {
  width: 180px;
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 12px;
}

.chat-stamp-fallback {
  display: grid;
  place-items: center;
  width: 180px;
  max-width: 100%;
  aspect-ratio: 1.25;
  border: 1px dashed rgba(82, 97, 116, 0.45);
  border-radius: 12px;
  background: rgba(244, 247, 247, 0.72);
  color: #66757c;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.inline-emoji {
  display: inline-block;
  width: 1.15em;
  height: 1.15em;
  vertical-align: -0.2em;
  object-fit: contain;
}

.inline-emoji-fallback {
  color: currentColor;
  font-size: 0.72em;
  text-align: center;
}

@media (min-width: 700px) and (max-width: 1099px) {
  .msg-body { max-width: 74%; }
  .chat-avatar { width: 38px; height: 38px; }
  .bubble-idol, .bubble-producer { padding: 10px 13px; border-radius: 15px; }
  .chat-stamp, .chat-stamp-fallback { width: 156px; }
}

@media (max-width: 699px) {
  .msg-body, .bubble-producer { max-width: 82%; }
  .chat-avatar { width: 36px; height: 36px; }
  .bubble-idol, .bubble-producer { padding: 9px 12px; border-radius: 14px; }
  .chat-stamp, .chat-stamp-fallback { width: 42vw; max-width: 148px; }
}
</style>
