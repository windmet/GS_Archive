// The confirmed membership ID owns grouping; names and colours are display only.
export function groupIdolsByUnit(idols, units) {
  const remaining = new Set(idols)
  const groups = units.map(unit => {
    const members = idols.filter(idol => String(idol.unitId) === String(unit.id))
    members.forEach(idol => remaining.delete(idol))
    return { ...unit, members }
  }).filter(unit => unit.members.length)
  if (remaining.size) groups.push({ id: 'unassigned', name: '其他偶像', members: [...remaining] })
  return groups
}
