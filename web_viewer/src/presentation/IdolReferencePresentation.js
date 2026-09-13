const IDOL_CODE = /^\d{3}[a-z0-9]{3}$/i

/** Identity comes from the idol dictionary; a missing owner is never replaced by a different idol. */
export function buildIdolReference(idolCode, dictionary, manifest, context = '') {
  const code = IDOL_CODE.test(idolCode || '') ? idolCode : ''
  const profile = code ? dictionary?.by_idol_code?.[code] : null
  const displayName = typeof profile?.display_name === 'string' ? profile.display_name.trim() : ''
  if (!displayName) {
    return {
      idolCode: code,
      displayName: '姓名待确认',
      unitName: '',
      actionable: false,
      imageCandidates: [],
      source: { kind: 'unresolved', context },
    }
  }

  const membership = manifest?.unit_membership_by_idol?.[code]
  return {
    idolCode: code,
    displayName,
    unitName: membership?.unit_name || profile.unit_name || '',
    actionable: true,
    imageCandidates: [{ url: `/assets/idols/icons/image_chara_icon_${code}.png`, kind: 'idol_icon' }],
    source: { kind: 'idol_unit_dictionary', context },
  }
}
