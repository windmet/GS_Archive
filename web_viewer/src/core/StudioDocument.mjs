/** JSON-only composition; array order is back-to-front within each layer. */
export const STUDIO_DOCUMENT_VERSION = 1;
export const STUDIO_LIMITS = { actors: 6, stickers: 32 };
export function createStudioDocument() {
  return {
    schemaVersion: 1,
    background: { spotId: null, sceneId: null, zoom: 1 },
    actors: [],
    stickers: [],
    frameId: null,
    filterId: null,
  };
}
const numeric = (value, min, max, label) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw Error(`无效的${label}`);
  return value;
};
const identity = (value) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw Error("无效的素材编号");
  return value;
};
export function validateStudioDocument(input) {
  if (
    input?.schemaVersion !== 1 ||
    !Array.isArray(input.actors) ||
    !Array.isArray(input.stickers) ||
    input.actors.length > 6 ||
    input.stickers.length > 32
  )
    throw Error("不支持的构图文档");
  const result = createStudioDocument(),
    ids = new Set();
  const instance = (row) => {
    if (
      typeof row.instanceId !== "string" ||
      !/^[-a-z0-9]{1,80}$/i.test(row.instanceId) ||
      ids.has(row.instanceId)
    )
      throw Error("重复或无效的画布对象");
    ids.add(row.instanceId);
    return {
      instanceId: row.instanceId,
      x: numeric(row.x, -1, 2, "横向位置"),
      y: numeric(row.y, -1, 3, "纵向位置"),
      scale: numeric(row.scale, 0.1, 5, "大小"),
      rotation: numeric(row.rotation ?? 0, -180, 180, "旋转"),
    };
  };
  result.background = {
    spotId:
      input.background?.spotId == null
        ? null
        : identity(input.background.spotId),
    sceneId:
      input.background?.sceneId == null
        ? null
        : identity(input.background.sceneId),
    zoom: numeric(input.background?.zoom ?? 1, 1, 3, "背景缩放"),
  };
  result.actors = input.actors.map((row) => {
    if (
      typeof row.modelId !== "string" ||
      !/^\d{3}[a-z]{3}_\d{3}_\d{2}$/.test(row.modelId)
    )
      throw Error("无效的服装模型");
    return {
      ...instance(row),
      idolId: identity(row.idolId),
      modelId: row.modelId,
      poseId: identity(row.poseId),
      faceId: identity(row.faceId),
      poseTime:
        row.poseTime == null ? null : numeric(row.poseTime, 0, 60, "动作时刻"),
      faceTime: numeric(row.faceTime ?? 0, 0, 60, "表情时刻"),
    };
  });
  result.stickers = input.stickers.map((row) => ({
    ...instance(row),
    stickerId: identity(row.stickerId),
  }));
  result.frameId = input.frameId == null ? null : identity(input.frameId);
  result.filterId = input.filterId == null ? null : identity(input.filterId);
  return result;
}
export function moveStudioObject(document, kind, id, direction) {
  const rows = document[kind],
    index = rows.findIndex((row) => row.instanceId === id),
    target = index + direction;
  if (index >= 0 && target >= 0 && target < rows.length)
    [rows[index], rows[target]] = [rows[target], rows[index]];
}
export function studioObject(document, id) {
  return (
    [...document.actors, ...document.stickers].find(
      (row) => row.instanceId === id,
    ) || null
  );
}
export function validateStudioSources(document, materials, actorViews) {
  validateStudioDocument(document);
  const { spotId, sceneId } = document.background;
  if (
    !materials.spots.some((row) => row.id === spotId) ||
    !materials.sceneIdsBySpotId[spotId]?.includes(sceneId)
  )
    throw Error("背景与场景不属于同一地点");
  for (const row of document.actors) {
    const view = actorViews.get(String(row.idolId));
    if (
      !view ||
      !view.actor.poses.some((p) => p.id === row.poseId) ||
      !view.actor.faces.some((p) => p.id === row.faceId) ||
      !view.media.models[row.modelId] ||
      !view.costumes.some((c) => c.modelId === row.modelId)
    )
      throw Error("人物、服装与摄影预设身份不匹配");
  }
  for (const [kind, key] of [
    ["stickers", "stickerId"],
    ["frames", "frameId"],
    ["filters", "filterId"],
  ]) {
    const values =
      kind === "stickers"
        ? document.stickers.map((row) => row[key])
        : [document[key]].filter((value) => value !== null);
    if (values.some((id) => !materials[kind].some((row) => row.id === id)))
      throw Error("构图引用了未收录的素材");
  }
  return document;
}
