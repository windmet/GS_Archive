// Native ADV stage geometry (client 2.6.10), in StoryIdolCanvas units: x right, y up, origin at the canvas
// centre, which StoryIdolCamera (orthographic, local (0, 0, -500)) looks at.
// - StoryCamera keeps orthographicSize 4.347826 world units (the canvas is scaled 1/72) while the screen is
//   at least 16:9; narrower screens keep the 16:9 width instead. The view is 626.087 units tall.
// - AdventureCharacterParent puts idol slots under Near/NotChangedPriority, which SetOffsetPosition moves to
//   (0, -50). IdolCharacter.localPosition = idol_position + idol_zoom position; localScale = idol_zoom size.
// - IdolFigureSkeleton.EditPlacement keeps the costume prefab root's anchoredPosition (0, prefabY); the
//   skeleton draws 1/300 world units per spine pixel at referencePixelsPerUnit 100, i.e. 1/3 canvas unit.
// - IdolFigureTexture gives the sprite its native size (100 px per unit) with pivot (0.5, 0) at
//   (0, otherSetting.positionY ?? -640).
// - AdventureBackgroundPanel (1800x960) is scaled orthographicSize / 5 at setup and only grows when a camera
//   zoom widens the view, so it covers 4/3 of the view height.
export const ADV_ORTHOGRAPHIC_SIZE = 4.347826
export const ADV_CANVAS_PER_WORLD = 72
export const ADV_VIEW_HEIGHT = 2 * ADV_ORTHOGRAPHIC_SIZE * ADV_CANVAS_PER_WORLD
export const ADV_REFERENCE_ASPECT = 16 / 9
export const ADV_VIEW_WIDTH = ADV_VIEW_HEIGHT * ADV_REFERENCE_ASPECT
export const ADV_IDOL_OFFSET_Y = -50
export const SKELETON_CANVAS_PER_PIXEL = 1 / 3
export const TEXTURE_FIGURE_POSITION_Y = -640
export const BACKGROUND_PANEL_SCALE = ADV_ORTHOGRAPHIC_SIZE / 5

// Screen pixels per canvas unit for a width x height stage.
export function advStageUnit(width, height) {
  if (!(width > 0) || !(height > 0)) return 1
  const aspect = width / height
  if (aspect >= ADV_REFERENCE_ASPECT) return height / ADV_VIEW_HEIGHT
  return width / advVisibleWidth(aspect)
}

// The client is landscape-only, so portrait has no native rule: from a square screen down to 1:2 the visible
// stage width narrows from the 16:9 width to ADV_PORTRAIT_VISIBLE_WIDTH. Figures grow by the same ratio; slot
// offsets do not (advHorizontalSqueeze), so a centred pair at the usual +-200 slots stays in view. 496 is the
// 1.25x upper-body framing calibrated against game captures (620 / 1.25): with advViewOriginY it keeps a
// figure's cut-off lower edge below the screen, as the client always does, and the face above the text box.
// Landscape and square are unchanged.
export const ADV_PORTRAIT_VISIBLE_WIDTH = 496
export function advVisibleWidth(aspect) {
  if (aspect >= 1) return ADV_VIEW_WIDTH
  const t = Math.min(1, Math.max(0, (aspect - 0.5) / 0.5))
  return ADV_PORTRAIT_VISIBLE_WIDTH + (ADV_VIEW_WIDTH - ADV_PORTRAIT_VISIBLE_WIDTH) * t
}

// Portrait only: actor slots and camera pans spread over the full 16:9 width, which a narrow screen cannot show,
// so their horizontal offsets are squeezed by the same ratio the visible width shrank (figure size is unchanged,
// neighbours may overlap a little). 1 for landscape and square screens.
export function advHorizontalSqueeze(width, height) {
  if (!(width > 0) || !(height > 0)) return 1
  return advVisibleWidth(width / height) / ADV_VIEW_WIDTH
}

// Screen y of the canvas origin (the native view centre). Landscape and square centre it, as the client does.
// On portrait the figures grow (advVisibleWidth); centring them would leave the figure's cut-off lower edge
// floating in view above the screen bottom. Instead the native view's top edge stays where a square screen puts
// it, ADV_PORTRAIT_VIEW_TOP of the height, and figures grow downward from there past the screen bottom.
export const ADV_PORTRAIT_VIEW_TOP = (1 - 1 / ADV_REFERENCE_ASPECT) / 2
export function advViewOriginY(width, height) {
  if (!(width > 0) || !(height > 0) || width >= height) return height / 2
  return height * ADV_PORTRAIT_VIEW_TOP + ADV_VIEW_HEIGHT / 2 * advStageUnit(width, height)
}

export function advToScreen(width, height, x, y) {
  const unit = advStageUnit(width, height)
  return { x: width / 2 + x * unit * advHorizontalSqueeze(width, height), y: advViewOriginY(width, height) - y * unit }
}

// IdolCharacter origin in canvas units.
export function idolSlotPosition({ posX = 0, posY = 0, zoomX = 0, zoomY = 0 } = {}) {
  return { x: posX + zoomX, y: ADV_IDOL_OFFSET_Y + posY + zoomY }
}

// Screen placement of a skeleton figure: root position and Pixi scale for spine-pixel coordinates.
export function skeletonFigureScreen(width, height, slot, prefabY, zoom = 1) {
  const point = advToScreen(width, height, slot.x, slot.y + prefabY * zoom)
  return { ...point, scale: advStageUnit(width, height) * zoom * SKELETON_CANVAS_PER_PIXEL }
}

// Screen placement of a texture figure's site image: top-left corner and Pixi scale for image pixels.
export function textureFigureScreen(width, height, slot, texture, positionY = TEXTURE_FIGURE_POSITION_Y, zoom = 1) {
  const [rectWidth] = texture.size
  const [offsetX, offsetY] = texture.offset
  const [, imageHeight] = texture.image
  const unit = advStageUnit(width, height)
  const top = slot.y + (positionY + offsetY + imageHeight) * zoom
  const centre = advToScreen(width, height, slot.x, top)
  return { x: centre.x + (-rectWidth / 2 + offsetX) * zoom * unit, y: centre.y, scale: unit * zoom }
}

// Screen size of the background panel (its Image stretches any sprite to the 1800x960 rect), centred.
export const BACKGROUND_PANEL_SIZE = Object.freeze([1800, 960])
export function backgroundScreenSize(width, height) {
  const unit = advStageUnit(width, height) * BACKGROUND_PANEL_SCALE
  return { width: BACKGROUND_PANEL_SIZE[0] * unit, height: BACKGROUND_PANEL_SIZE[1] * unit }
}

// Background sprite rect in background-container space: the panel, centred on the canvas origin
// (advViewOriginY); only stages wider than the panel (about 2.5:1), or portrait screens taller than it, enlarge
// it further to stay covered on every side.
export function backgroundPanelRect(width, height) {
  const panel = backgroundScreenSize(width, height)
  const originY = advViewOriginY(width, height)
  const cover = Math.max(1, width / panel.width, 2 * originY / panel.height, 2 * (height - originY) / panel.height)
  const rectWidth = panel.width * cover, rectHeight = panel.height * cover
  return { x: (width - rectWidth) / 2, y: originY - rectHeight / 2, width: rectWidth, height: rectHeight }
}

// StoryCamera.MoveCamera at camera (x, y) canvas units and zoom: the actor layer scales by zoom about the view
// centre and follows the camera; ResizeCamera only grows the background panel when the view widens, so the
// background scales by max(1, zoom) with the same shift.
export function cameraScreenTransform(width, height, { zoom = 1, x = 0, y = 0 } = {}) {
  const unit = advStageUnit(width, height)
  const shiftX = -x * unit * zoom * advHorizontalSqueeze(width, height), shiftY = y * unit * zoom
  const bgScale = Math.max(1, zoom)
  const originY = advViewOriginY(width, height)
  return {
    scale: zoom, x: width / 2 * (1 - zoom) + shiftX, y: originY * (1 - zoom) + shiftY,
    bgScale, bgX: width / 2 * (1 - bgScale) + shiftX, bgY: originY * (1 - bgScale) + shiftY,
  }
}
