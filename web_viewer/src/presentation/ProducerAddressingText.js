import { renderProducerAddressing } from '../localization/story/ProducerAddressing.js'
import { producerName } from '../utils/LanguageStore.js'

// Derived titles and previews have no text_ref and must never mutate their source data.
export function presentProducerAddressingText(source) {
  return renderProducerAddressing(typeof source === 'string' ? source : '', producerName.value)
}
