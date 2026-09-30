import { ref } from 'vue'

export const READER_THEME_KEY = 'sidem_reader_theme'
export const READER_THEMES = Object.freeze([
  { id: 'light', label: '极简白', swatch: '#FFFFFF' },
  { id: 'warm', label: '护眼暖阳', swatch: '#F3EFE6' },
  { id: 'dark', label: '深夜暗色', swatch: '#1E293B' },
  { id: 'mint', label: '冰青冷调（事务所）', swatch: '#EDF5F5' },
])
const valid = id => READER_THEMES.some(theme => theme.id === id)
// Earlier releases saved the office theme as "game". Preserve that choice.
const canonical = id => id === 'game' ? 'mint' : id

export function createReaderThemeStore({ getStorage = () => globalThis.localStorage } = {}) {
  let saved
  try { saved = getStorage()?.getItem(READER_THEME_KEY) } catch { /* Storage may be disabled. */ }
  const theme = ref(valid(canonical(saved)) ? canonical(saved) : 'light')
  function setTheme(id) {
    id = canonical(id)
    if (!valid(id)) return false
    theme.value = id
    try { getStorage()?.setItem(READER_THEME_KEY, id) } catch { /* Reading still works without persistence. */ }
    return true
  }
  return { theme, setTheme }
}

const store = createReaderThemeStore()
export const readerTheme = store.theme
export const setReaderTheme = store.setTheme
