import {IDOL_ID_TO_NAME} from '../utils/IdolNameMap.js'
import {UNIT_CODE_TO_NAME} from '../utils/UnitNameMap.js'
const idols = new Set(Object.keys(IDOL_ID_TO_NAME).filter(id=>/^0\d{2}[a-z]{3}$/.test(id)&&Number(id.slice(0,3))<=49))
const units = new Set(Object.keys(UNIT_CODE_TO_NAME))
const itemCategories = new Set(['recovery','tickets','card-materials','skill-training','live-boost','story-unlock','exchange','event-materials','other'])
const honorCategories = new Set(['idol','event','normal','other'])
const costumeCategories = new Set(['live','story-only'])
// One catalogue page, four kinds; each kind's entity key is `<type>:<id>` in the shape its catalog publishes.
export const COLLECTION_KINDS = Object.freeze({
  items: { type:'item', id:/^\d+$/, categories:itemCategories, label:'道具' },
  honors: { type:'honor', id:/^\d+$/, categories:honorCategories, label:'称号' },
  currencies: { type:'currency', id:/^[a-z]+(?:-[a-z]+)*$/, categories:new Set(), label:'货币' },
  costumes: { type:'costume', id:/^[0-9]{3}[a-z]{3}_[0-9]{3}_[0-9]{2}$/, categories:costumeCategories, label:'服装' },
})
export function collectionKindForEntity(key) {
  const [type, ...rest] = String(key || '').split(':')
  return Object.keys(COLLECTION_KINDS).find(kind => COLLECTION_KINDS[kind].type === type && COLLECTION_KINDS[kind].id.test(rest.join(':'))) || ''
}
export const collectionKindLabel = kind => COLLECTION_KINDS[kind]?.label || '道具'
export function normalizeCollectionRoute(input = {}) {
  const entityKind = collectionKindForEntity(input.entity)
  const supplied = input.collection || {}
  const kind = COLLECTION_KINDS[supplied.kind] ? supplied.kind : entityKind || 'items'
  const category = supplied.category === 'achievement' ? 'normal' : supplied.category
  // Honors and costumes belong to idols, so both narrow by idol and unit.
  const owned = ['honors','costumes'].includes(kind)
  return { entity: entityKind === kind ? input.entity : '', collection: {
    kind, category: COLLECTION_KINDS[kind].categories.has(category) ? category : '',
    idol: owned && idols.has(supplied.idol) ? supplied.idol : '',
    unit: owned && units.has(supplied.unit) ? supplied.unit : '',
    attribute: kind === 'items' && ['physical','intelligent','mental'].includes(supplied.attribute) ? supplied.attribute : '',
    page: Number.isInteger(Number(supplied.page)) && Number(supplied.page) >= 0 ? Math.min(10000, Number(supplied.page)) : 0,
  } }
}
