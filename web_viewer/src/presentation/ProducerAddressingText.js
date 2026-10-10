import { renderProducerAddressing } from '../localization/story/ProducerAddressing.js'
import { producerName } from '../utils/LanguageStore.js'

// Derived titles and previews have no text_ref and must never mutate their source data.
// locale names the language of the text when the caller knows it; otherwise it is inferred.
export function presentProducerAddressingText(source, locale) {
  return renderProducerAddressing(typeof source === 'string' ? source : '', producerName.value, { locale })
}
