import { honorIdol as collectionHonorIdol } from '../../presentation/CollectionBrowse.js'
import { idolHonorIdentity } from '../../presentation/HonorIdentity.mjs'
import { archiveText } from './useArchiveCollectionText.js'

// One title for an honor everywhere it is listed (catalog, tooltip, detail, search). FES achievement
// names are internal condition labels ("23/3FES限定フォトを最大まで限界突破させる_渡辺みのり"); they are
// titled by what they are and whose they are. Every other honor keeps its own (translated) name.
const FES_TITLES = { 'fes-change': 'FES 限定卡换装', 'fes-limitbreak': 'FES 限定卡满破' }

export function honorIdol(entry, displayIdolName = () => '') {
  const idol = collectionHonorIdol(entry)
  return idol ? { code: idol.id, kind: idolHonorIdentity(entry).kind, name: displayIdolName(idol.id, idol.name) || idol.name } : null
}

export function honorTitle(entry, displayIdolName = () => '') {
  const idol = honorIdol(entry, displayIdolName)
  return FES_TITLES[idol?.kind] ? `${FES_TITLES[idol.kind]} · ${idol.name}` : archiveText('honor', entry?.nameJa || entry?.name)
}

