import { createStudioDocument } from "./StudioDocument.mjs";

/** Editable reconstructions from the user's two pictures; not original save data. */
export function studioReference(name, views) {
  const doc = createStudioDocument(),
    b = name === "B";
  doc.background = { spotId: b ? 24 : 14, sceneId: b ? 23 : 27, zoom: 4 / 3 };
  const specs = b
    ? [
        [5, "005kao_002_00", "weight", "face_trouble", 0.266653, 1.999961, 2.061239],
        [6, "006tsu_005_00", "hello", "face_joy", 0.946039, 2.010002, 2.100141],
        [4, "004ter_001_00", "hello", "face_happy", 0.470672, 2.019536, 2.094187],
      ]
    : [
        [38, "038tak_005_00", "wait_loop", "face_serious", 0.333948, 2.029984, 2.099590],
        [40, "040ren_005_00", "weight", "face_angry", 0.672863, 2.025363, 2.077352],
      ];
  doc.actors = specs.map(([idolId, modelId, motion, face, x, y, scale], i) => {
    const view = views.get(String(idolId));
    if (!view) throw Error("参考构图的偶像资料尚未读取");
    const pose = view.actor.poses.find(
        (row) => view.media.entries[`poses:${row.id}`].preset.motion === motion,
      ),
      expression = view.actor.faces.find(
        (row) => view.media.entries[`faces:${row.id}`].preset.face === face,
      );
    if (!pose || !expression || !view.media.models[modelId])
      throw Error("参考构图的服装或动作尚未绑定");
    return {
      instanceId: `reference-${name}-actor-${i}`,
      idolId,
      modelId,
      layoutBasis: 'source-bounds',
      poseId: pose.id,
      faceId: expression.id,
      x,
      y,
      scale,
      rotation: 0,
      poseTime: null,
      faceTime: b && [5, 6].includes(idolId) ? 3.4 : 0,
    };
  });
  const stickers = b
    ? [
        [24, 0.225, 0.21, 0.5, -15],
        [64, 0.51, 0.155, 0.85, 19],
        [27, 0.56, 0.44, 0.53, 0],
        [46, 0.92, 0.55, 0.63, 0],
        [32, 0.3, 0.81, 0.55, -24],
      ]
    : [
        [140, 0.072, 0.475, 0.95, 0],
        [62, 0.145, 0.24, 0.5, 0],
        [32, 0.39, 0.295, 0.55, 18],
        [53, 0.655, 0.156, 0.5, 0],
        [48, 0.486, 0.82, 0.63, 0],
      ];
  doc.stickers = stickers.map(([stickerId, x, y, scale, rotation], i) => ({
    instanceId: `reference-${name}-sticker-${i}`,
    stickerId,
    x,
    y,
    scale,
    rotation,
  }));
  return doc;
}
