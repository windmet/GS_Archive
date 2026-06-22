import { ref } from 'vue'

export const languageMode = ref('JP')

export function setLanguageMode(mode) {
  languageMode.value = mode
}
