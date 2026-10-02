import index from '../../config/collection-browse.v1.json' with {type:'json'}
import {IDOL_ID_TO_NAME} from '../utils/IdolNameMap.js'
import {getUnitCodeByCharaId} from '../utils/UnitNameMap.js'
import {honorBondSource} from './HonorBondSource.mjs'
import {rewardCondition,rewardRelationLabel} from '../components/archive/DomainPresentation.mjs'
export const collectionIdols=Object.entries(IDOL_ID_TO_NAME).filter(([id])=>/^0\d{2}[a-z]{3}$/.test(id)&&Number(id.slice(0,3))<=49).map(([id,name])=>({id,name,unit:getUnitCodeByCharaId(id)}))
export function collectionSummary(row,kind,release) {
  const entry=index.entries[`${kind==='honors'?'honor':'item'}:${row.id}`]
  return release===index.release && entry?.nameJa===row.nameJa && entry?.resourceId===row.resourceId ? entry : null
}
export function honorIdol(row) {
  if(row.honorType!==2 || row.resourceId!==`honor_idol_${row.id}`)return null
  const match=/^2(\d{2})\d{5}$/.exec(String(row.id))
  return match?collectionIdols.find(idol=>Number(idol.id.slice(0,3))===Number(match[1])) || null:null
}
export function honorGroup(row){return row.honorType===2?'idol':row.honorType===3?'event':row.honorType===1?'achievement':'other'}
export function itemAttribute(row) {
  // Names identify the source attribute; unknown/event items stay neutral.
  return row.nameJa?.startsWith('フィジカル')?'physical':row.nameJa?.startsWith('インテリ')?'intelligent':row.nameJa?.startsWith('メンタル')?'mental':''
}
export function honorSourceLabel(row,release) {
  const bond=honorBondSource(row)
  if(bond)return `偶像羁绊 Lv.${bond.level}`
  const source=collectionSummary(row,'honors',release)?.sources[0]
  if(!source)return '来源未知'
  const label=source.event?.title || rewardRelationLabel(source)
  return `${label} · ${rewardCondition(source)}`
}
