<template>
  <div class="msg-row" :class="message.isProducer ? 'row-producer' : 'row-idol'">
    <template v-if="!message.isProducer">
      <img v-if="message.charaId" class="chat-avatar" :src="getMobileIconUrl(message.charaId)" alt="" />
      <div class="msg-body">
        <span v-if="message.speaker" class="chat-name">{{ message.speaker }}</span>
        <img v-if="message.isStamp" class="chat-stamp" :src="getStampUrl(message.stampId)" alt="stamp" />
        <LocalizedTextBlock v-else-if="message.display" class="bubble-idol" :display="message.display">
          <template #primary="{ text }">
            <template v-for="(part, partIndex) in messageParts(text)" :key="`primary-${partIndex}`">
              <span v-if="part.type === 'text'">{{ part.text }}</span>
              <img v-else class="inline-emoji" :src="getEmojiUrl(part.id)" alt="" />
            </template>
          </template>
          <template #secondary="{ text }">
            <template v-for="(part, partIndex) in messageParts(text)" :key="`secondary-${partIndex}`">
              <span v-if="part.type === 'text'">{{ part.text }}</span>
              <img v-else class="inline-emoji" :src="getEmojiUrl(part.id)" alt="" />
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
            <img v-else class="inline-emoji" :src="getEmojiUrl(part.id)" alt="" />
          </template>
        </template>
        <template #secondary="{ text }">
          <template v-for="(part, partIndex) in messageParts(text)" :key="`secondary-${partIndex}`">
            <span v-if="part.type === 'text'">{{ part.text }}</span>
            <img v-else class="inline-emoji" :src="getEmojiUrl(part.id)" alt="" />
          </template>
        </template>
      </LocalizedTextBlock>
      <div class="producer-spacer"></div>
    </template>
  </div>
</template>

<script setup>
import LocalizedTextBlock from '../LocalizedTextBlock.vue'
import { getEmojiUrl, getMobileIconUrl, getStampUrl } from '../../utils/AssetResolver.js'

defineProps({
  message: { type: Object, required: true },
})

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

.chat-name {
  font-size: 0.72rem;
  color: var(--player-ink-700);
  margin-left: 4px;
  margin-bottom: 3px;
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

/* The THE 虎牙道 dark background needs a readable name label */
:deep(.msg-row) .chat-name {
  text-shadow: 0 1px 3px rgba(255, 255, 255, 0.9);
}

@media (min-width: 700px) and (max-width: 1099px) {
  .msg-body { max-width: 74%; }
  .chat-avatar { width: 38px; height: 38px; }
  .bubble-idol, .bubble-producer { padding: 10px 13px; border-radius: 15px; }
  .chat-stamp { width: 156px; }
}

@media (max-width: 699px) {
  .msg-body, .bubble-producer { max-width: 82%; }
  .chat-avatar { width: 36px; height: 36px; }
  .bubble-idol, .bubble-producer { padding: 9px 12px; border-radius: 14px; }
  .chat-stamp { width: 42vw; max-width: 148px; }
}
</style>
