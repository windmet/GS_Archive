// In idol-owned modes the idol is authoritative; only Unit Talk may choose a separate unit.
export function resolveMobileArchiveUnit({ idolCode, mode, requestedUnit = '', manifest, units = [], archive } = {}) {
  const validUnits = new Set(units.map(unit => unit.unit_code).filter(code => archive?.by_unit_code?.[code]))
  const membership = manifest?.unit_membership_by_idol?.[idolCode]?.unit_code || ''
  const idolUnit = validUnits.has(membership) ? membership : ''
  if (mode === 'unit' && validUnits.has(requestedUnit)) return requestedUnit
  return idolUnit
}
