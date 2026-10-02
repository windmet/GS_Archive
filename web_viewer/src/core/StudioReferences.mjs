import { createStudioDocument } from "./StudioDocument.mjs";

/** Editable reconstructions from the user's two pictures; not original save data. */
export function studioReference(name, views) {
  const doc = createStudioDocument(),
    b = name === "B";
  doc.background = { spotId: b ? 24 : 14, sceneId: b ? 23 : 27, zoom: 4 / 3 };
  const specs = b
    ? [
        [6, "006tsu_005_00", "hello", "face_joy", 0.939410, 1.960258, 2.089640],
        [4, "004ter_001_00", "surprise", "face_happy", 0.470672, 2.019536, 2.094187],
        [5, "005kao_002_00", "weight", "face_trouble", 0.266653, 1.999961, 2.061239],
      ]
    : [
        [38, "038tak_005_00", "wait_loop", "face_serious", 0.298632, 2.045144, 2.041851],
        [40, "040ren_005_00", "weight", "face_angry", 0.642228, 1.946314, 1.947518, 2],
      ];
  doc.actors = specs.map(([idolId, modelId, motion, face, x, y, scale, rotation = 0], i) => {
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
      rotation,
      poseTime: null,
      faceTime: b && [5, 6].includes(idolId) ? 3.4 : 0,
    };
  });
  const stickers = b
    ? [
        [24, 0.224219, 0.209722, 0.502, -12],
        [64, 0.508594, 0.186111, 0.814, 21.5],
        [27, 0.558594, 0.436111, 0.496, 0],
        [46, 0.927344, 0.556944, 0.648, 6.5],
        [32, 0.302344, 0.808333, 0.502, 4],
      ]
    : [
        [140, 0.076563, 0.461111, 0.942, 2.5],
        [62, 0.145313, 0.244444, 0.499, 3],
        [32, 0.382031, 0.298611, 0.502, 16.5],
        [53, 0.650781, 0.156250, 0.499, -10],
        [48, 0.482813, 0.831250, 0.631, -0.5],
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
