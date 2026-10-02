const prefixes = {Physical:'体能',Intelli:'知性',Intelligent:'知性',Mental:'心理'}
// A display alias for the nine attribute materials; preserve reviewed fields and source keys.
export function collectionAttributeName(text,locale='zh-CN') {
  if(locale!=='zh-CN'||typeof text!=='string')return text
  return text.replace(/^(Physical|Intelligent|Intelli|Mental)\s*(戒指|脚链|徽章)$/,(_,prefix,item)=>prefixes[prefix]+item)
}
