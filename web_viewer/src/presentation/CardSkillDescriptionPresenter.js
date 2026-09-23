// Effect parameters exist in the raw skill record, but dXX-to-effect semantics are not established.
// Keep the trigger text while making the unknown value explicit instead of inventing a percentage.
export function presentCardSkillDescription(description) {
  if (typeof description !== 'string' || !description.trim()) return '技能数值说明暂未收录。'
  return description.replace(/<[a-z][a-z0-9_]*>(?:[%％])?/gi, '〔数值尚未解析〕')
}
