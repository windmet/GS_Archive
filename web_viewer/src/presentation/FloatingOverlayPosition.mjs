// All dimensions use viewport coordinates, including a zoomed visual viewport.
export function floatingOverlayPosition(anchor, size, viewport, margin = 8, gap = 8) {
  const x = viewport.left || 0, y = viewport.top || 0
  const width = Math.min(size.width, Math.max(0, viewport.width - margin * 2))
  const height = Math.min(size.height, Math.max(0, viewport.height - margin * 2))
  const bottom = y + viewport.height - margin
  const fitsBelow = anchor.bottom + gap + height <= bottom
  const moreAbove = anchor.top - y > y + viewport.height - anchor.bottom
  const above = !fitsBelow && moreAbove
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max))
  return {
    left: clamp(anchor.left, x + margin, x + viewport.width - margin - width),
    top: clamp(above ? anchor.top - gap - height : anchor.bottom + gap, y + margin, bottom - height),
    width, height, above,
  }
}
