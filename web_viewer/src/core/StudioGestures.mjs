import { STUDIO_WIDTH as W, STUDIO_HEIGHT as H } from './PictureStudioPolicy.mjs';

export const STUDIO_TRANSFORM_LIMITS = { x: [-1, 2], y: [-1, 3], scale: [.1, 5], rotation: [-180, 180] };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const studioRotation = value => ((value + 180) % 360 + 360) % 360 - 180;
export function studioTransformPatch(values) {
  return Object.fromEntries(Object.entries(values)
    .filter(([key, value]) => STUDIO_TRANSFORM_LIMITS[key] && Number.isFinite(value))
    .map(([key, value]) => [key, clamp(value, ...STUDIO_TRANSFORM_LIMITS[key])]));
}

/** Apply a screen-space similarity about the fingers/handle, not the offscreen feet. */
export function studioTransformAround(row, from, to, factor = 1, angle = 0) {
  const scale = clamp(row.scale * factor, ...STUDIO_TRANSFORM_LIMITS.scale);
  const ratio = scale / row.scale, radians = angle * Math.PI / 180;
  const dx = row.x * W - from.x, dy = row.y * H - from.y;
  return studioTransformPatch({
    x: (to.x + ratio * (dx * Math.cos(radians) - dy * Math.sin(radians))) / W,
    y: (to.y + ratio * (dx * Math.sin(radians) + dy * Math.cos(radians))) / H,
    scale, rotation: studioRotation(row.rotation + angle),
  });
}
const vector = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
const length = value => Math.hypot(value.x, value.y);
const degrees = value => Math.atan2(value.y, value.x) * 180 / Math.PI;
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** One object owns both fingers until they are released. No timers or DOM state. */
export class StudioGestures {
  constructor({ getRow, onTransform }) {
    this.getRow = getRow;
    this.onTransform = onTransform;
    this.points = new Map();
    this.id = '';
  }
  down(pointerId, point, intent) {
    if (this.points.has(pointerId) || this.points.size >= 2) return false;
    if (!this.points.size) {
      const row = this.getRow(intent?.id);
      if (!row) return false;
      this.id = intent.id;
      this.current = { ...row };
      this.original = { ...row };
      this.mode = intent.mode || 'move';
      this.center = intent.center;
    }
    this.points.set(pointerId, { ...point });
    this.rebase();
    return true;
  }
  rebase() {
    this.base = { ...this.current };
    this.start = [...this.points.values()].map(point => ({ ...point }));
  }
  emit(patch) {
    this.current = { ...this.current, ...patch };
    this.onTransform(this.id, patch);
  }
  move(pointerId, point) {
    if (!this.points.has(pointerId)) return false;
    if (!this.getRow(this.id)) { this.cancel(); return false; }
    this.points.set(pointerId, { ...point });
    const points = [...this.points.values()];
    if (points.length === 2) {
      const before = vector(...this.start), after = vector(...points);
      if (length(before) < 8) { if (length(after) >= 8) this.rebase(); return true; }
      this.emit(studioTransformAround(this.base, midpoint(...this.start), midpoint(...points),
        length(after) / length(before), studioRotation(degrees(after) - degrees(before))));
    } else if (this.mode === 'move') {
      this.emit(studioTransformPatch({
        x: this.base.x + (point.x - this.start[0].x) / W,
        y: this.base.y + (point.y - this.start[0].y) / H,
      }));
    } else if (this.mode === 'scale' || this.mode === 'rotate') {
      const before = vector(this.center, this.start[0]), after = vector(this.center, point);
      if (length(before) < 8) return true;
      this.emit(studioTransformAround(this.base, this.center, this.center,
        this.mode === 'scale' ? length(after) / length(before) : 1,
        this.mode === 'rotate' ? studioRotation(degrees(after) - degrees(before)) : 0));
    }
    return true;
  }
  up(pointerId) {
    if (!this.points.delete(pointerId)) return false;
    if (this.points.size) { this.mode = 'move'; this.rebase(); }
    else this.cancel();
    return true;
  }
  cancel(restore = false) {
    if (restore && this.id && this.getRow(this.id))
      this.emit(studioTransformPatch(this.original));
    this.points.clear();
    this.id = '';
  }
}

/** Keep handles on the visible crop of oversized actors; targets are 44 CSS px. */
export function studioSelectionControls(bounds, cssWidth) {
  const rect = { x: Math.max(0, bounds.x), y: Math.max(0, bounds.y),
    right: Math.min(W, bounds.x + bounds.width), bottom: Math.min(H, bounds.y + bounds.height) };
  if (rect.right <= rect.x || rect.bottom <= rect.y || !(cssWidth > 0)) return null;
  const unit = W / cssWidth;
  const inset = 12 * unit;
  const x = clamp(rect.right + inset, inset, W - inset);
  let rotateY = clamp(rect.y - inset, inset, H - inset);
  let scaleY = clamp(rect.bottom + inset, inset, H - inset);
  if (scaleY - rotateY < 44 * unit) {
    scaleY = clamp(rotateY + 44 * unit, inset, H - inset);
    rotateY = scaleY - 44 * unit;
  }
  return { rect, unit, radius: 22 * unit,
    center: { x: (rect.x + rect.right) / 2, y: (rect.y + rect.bottom) / 2 },
    rotate: { x, y: rotateY },
    scale: { x, y: scaleY },
  };
}
