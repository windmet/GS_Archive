const record = value => value && typeof value === 'object' && !Array.isArray(value)

/** Check the structural fields read by current consumers. This does not prove
 * per-model coverage, valid bone names, or that a renderer adopted the data. */
export function validateStoryConfig(kind, data) {
  const fields = { 'idol-motion': 'entries', 'costume-prefab-metadata': 'models', 'costume-dictionary': 'by_model_resource_id' }
  const valid = record(data) && (kind === 'idol-placement' ? Number.isFinite(data.positionY)
    : kind === 'idol-body-types' ? Array.isArray(data.dataList)
    : kind === 'model-mouth' ? Array.isArray(data.mouthes) && data.mouthes.length > 0
    : Object.hasOwn(fields, kind) && record(data[fields[kind]]))
  if (!valid) throw new Error(`Unusable ${kind} configuration`)
  return data
}
