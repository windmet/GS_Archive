/** The asset/preset/order identity, excluding edits already supported by the stage. */
export function studioResourceSignature(doc) {
  return JSON.stringify([doc.schemaVersion, doc.background.spotId, doc.background.sceneId, doc.frameId, doc.filterId,
    doc.actors.map(row => [row.instanceId, row.idolId, row.modelId, row.layoutBasis, row.poseId, row.faceId, row.poseTime == null]),
    doc.stickers.map(row => [row.instanceId, row.stickerId])]);
}

export function applyStudioDocumentTransforms(stage, doc) {
  const keys = ['x', 'y', 'scale', 'rotation', 'hidden', 'locked', 'poseTime', 'faceTime'];
  for (const [rows, models, apply] of [
    [doc.actors, stage.actorInstances, row => stage.setActorTransform(row.instanceId, row)],
    [doc.stickers, stage.stickerInstances, row => stage.setStickerTransform(row.instanceId, row)],
  ]) {
    for (const row of rows) {
      const previous = models.get(row.instanceId)?.row;
      if (!previous) throw Error('构图对象尚未载入');
      if (keys.some(key => previous[key] !== row[key])) apply(row);
    }
  }
  stage.setBackgroundZoom(doc.background.zoom);
}
