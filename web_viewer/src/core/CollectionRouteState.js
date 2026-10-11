import {IDOL_ID_TO_NAME} from '../utils/IdolNameMap.js'
import {UNIT_CODE_TO_NAME} from '../utils/UnitNameMap.js'
const idols = new Set(Object.keys(IDOL_ID_TO_NAME).filter(id=>/^0\d{2}[a-z]{3}$/.test(id)&&Number(id.slice(0,3))<=49))
const units = new Set(Object.keys(UNIT_CODE_TO_NAME))
const itemCategories = new Set(['recovery','tickets','card-materials','skill-training','live-boost','story-unlock','exchange','event-materials','other'])
const honorCategories = new Set(['idol','event','normal','other'])
export function normalizeCollectionRoute(input = {}) {
  const entity = /^(item|honor):\d+$/.test(input.entity || '') ? input.entity : ''
  const supplied = input.collection || {}
  const kind = ['items','honors'].includes(supplied.kind) ? supplied.kind : entity.startsWith('honor:') ? 'honors' : 'items'
  const category = supplied.category === 'achievement' ? 'normal' : supplied.category
  return { entity: entity.startsWith(kind === 'honors' ? 'honor:' : 'item:') ? entity : '', collection: {
    kind, category: (kind === 'honors' ? honorCategories : itemCategories).has(category) ? category : '',
    idol: kind === 'honors' && idols.has(supplied.idol) ? supplied.idol : '',
    unit: kind === 'honors' && units.has(supplied.unit) ? supplied.unit : '',
    attribute: kind === 'items' && ['physical','intelligent','mental'].includes(supplied.attribute) ? supplied.attribute : '',
    page: Number.isInteger(Number(supplied.page)) && Number(supplied.page) >= 0 ? Math.min(10000, Number(supplied.page)) : 0,
  } }
}
