import { MeshAttachment, RegionAttachment } from '@pixi-spine/runtime-3.8';

const inTriangle = (p, ax, ay, bx, by, cx, cy) => {
  const cross = (x1, y1, x2, y2) => x1 * y2 - y1 * x2;
  const a = cross(bx - ax, by - ay, p.x - ax, p.y - ay);
  const b = cross(cx - bx, cy - by, p.x - bx, p.y - by);
  const c = cross(ax - cx, ay - cy, p.x - cx, p.y - cy);
  if (Math.abs(cross(bx - ax, by - ay, cx - ax, cy - ay)) < .0001) return false;
  return (a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0);
};
export function studioSkeletonContains(skeleton, point) {
  const vertices = [];
  for (const slot of skeleton.drawOrder) {
    const attachment = slot.getAttachment();
    if (!slot.bone.active || slot.color.a <= .05 || (attachment?.color?.a ?? 1) <= .05) continue;
    let triangles;
    if (attachment instanceof RegionAttachment) {
      vertices.length = 8;
      attachment.computeWorldVertices(slot.bone, vertices, 0, 2);
      triangles = [0, 1, 2, 0, 2, 3];
    } else if (attachment instanceof MeshAttachment) {
      vertices.length = attachment.worldVerticesLength;
      attachment.computeWorldVertices(slot, 0, vertices.length, vertices, 0, 2);
      triangles = attachment.triangles;
    } else continue;
    for (let i = 0; i < triangles.length; i += 3) {
      const a = triangles[i] * 2, b = triangles[i + 1] * 2, c = triangles[i + 2] * 2;
      if (inTriangle(point, vertices[a], vertices[a + 1], vertices[b], vertices[b + 1], vertices[c], vertices[c + 1])) return true;
    }
  }
  return false;
}

export function studioStickerContains(entry, point) {
  const { sprite, texture, alpha } = entry;
  const local = sprite.toLocal(point), x = Math.floor(local.x + texture.width / 2), y = Math.floor(local.y + texture.height / 2);
  return x >= 0 && y >= 0 && x < texture.width && y < texture.height
    && (!alpha || alpha[(y * texture.width + x) * 4 + 3] > 20);
}
