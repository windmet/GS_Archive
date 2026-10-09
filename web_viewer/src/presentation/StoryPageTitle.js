import { presentProducerAddressingText } from './ProducerAddressingText.js'

// A story collection's name, shown alike by the page heading, the shell title and the breadcrumb.
// Birthday pages are named after their idol, in the reader's language, like every other page.
export function storyCollectionTitle(collection, idolName = () => '') {
  const subject = collection?.subject
  const name = subject?.kind === 'idol' && idolName(subject.code)
  return presentProducerAddressingText(name ? `${name} 生日剧情` : collection?.title || '')
}
