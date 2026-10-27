import source from '../data/costumeCategories.json' with {type:'json'}

export const COSTUME_CATEGORIES = Object.freeze([
  {id:'all',label:'全员套服'}, {id:'unit',label:'组合套服'},
  {id:'attribute',label:'属性套服'}, {id:'cross',label:'跨组合套服'},
  {id:'personal',label:'个人服装'}, {id:'story',label:'常服／剧情服'},
  {id:'other',label:'其他衣装'},
])
const categories=new Map(Object.entries(source.groups).flatMap(([scope,models])=>models.map(id=>[id,scope])))
export const costumeCategoryId = costume => categories.get(costume?.modelId) || 'other'
export function costumeCategoryCounts(costumes=[]) {
  return COSTUME_CATEGORIES.map(group=>({...group,count:costumes.filter(row=>costumeCategoryId(row)===group.id).length}))
    .filter(group=>group.count)
}
// A filter is view state: it never chooses or substitutes a model. Keep the
// current selection as an explicitly pinned option when it is outside the view.
export function costumeFilterView(costumes=[], category='', selectedId='') {
  const rows=category ? costumes.filter(row=>costumeCategoryId(row)===category) : costumes
  const current=costumes.find(row=>row.modelId===selectedId) || null
  return {rows, pinned:current && !rows.includes(current) ? current : null}
}
