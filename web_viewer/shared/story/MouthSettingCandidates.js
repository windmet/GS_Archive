/** Model-specific mouth settings take precedence; only an HTTP failure allows
 * the consumer to try the idol fallback. Network/parse failures do not. */
export function mouthSettingCandidates(idolId, modelId = '') {
  const prefix = modelId.replace(/_\d{3}_\d{2}$/, '')
  return prefix && prefix !== idolId ? [prefix, idolId] : [idolId]
}
