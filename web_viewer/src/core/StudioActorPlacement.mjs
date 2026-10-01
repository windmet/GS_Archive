import { STUDIO_WIDTH, STUDIO_HEIGHT } from './PictureStudioPolicy.mjs';

/** Source Spine setup bounds are Y-up; Pixi actor coordinates are Y-down. */
export function studioActorPlacement(data) {
  const { x, y, width, height } = data;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0)
    throw Error('模型缺少有效的原始尺寸');
  return {
    baseScale: Math.min(STUDIO_HEIGHT * .9 / height, STUDIO_WIDTH * .7 / width),
    pivotX: x + width / 2,
    pivotY: -y,
  };
}

/** Measure current attachments, avoiding Pixi's retained display-object cache. */
export function studioActorPoseBounds(skeleton) {
  const vector = () => ({ x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } });
  const offset = vector(), size = vector();
  skeleton.getBounds(offset, size);
  const bounds = { x: offset.x, y: offset.y, width: size.x, height: size.y };
  if (!Object.values(bounds).every(Number.isFinite) || size.x <= 0 || size.y <= 0)
    throw Error('模型展示范围无效');
  return bounds;
}

export function studioActorSelectionBounds(spine) {
  const b = studioActorPoseBounds(spine.skeleton);
  const points = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
    .map(([x, y]) => spine.toGlobal({ x, y }));
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
}
