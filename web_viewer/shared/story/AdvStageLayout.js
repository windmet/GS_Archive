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
  return width / height >= ADV_REFERENCE_ASPECT ? height / ADV_VIEW_HEIGHT : width / ADV_VIEW_WIDTH
}

export function advToScreen(width, height, x, y) {
  const unit = advStageUnit(width, height)
  return { x: width / 2 + x * unit, y: height / 2 - y * unit }
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
  const left = slot.x + (-rectWidth / 2 + offsetX) * zoom
  const top = slot.y + (positionY + offsetY + imageHeight) * zoom
  const point = advToScreen(width, height, left, top)
  return { ...point, scale: advStageUnit(width, height) * zoom }
}

// Screen size of the background panel (its Image stretches any sprite to the 1800x960 rect), centred.
export const BACKGROUND_PANEL_SIZE = Object.freeze([1800, 960])
export function backgroundScreenSize(width, height) {
  const unit = advStageUnit(width, height) * BACKGROUND_PANEL_SCALE
  return { width: BACKGROUND_PANEL_SIZE[0] * unit, height: BACKGROUND_PANEL_SIZE[1] * unit }
}

// Background sprite rect in background-container space: the panel, centred; only stages wider than the
// panel (about 2.5:1) enlarge it further to stay covered.
export function backgroundPanelRect(width, height) {
  const panel = backgroundScreenSize(width, height)
  const cover = Math.max(1, width / panel.width, height / panel.height)
  const rectWidth = panel.width * cover, rectHeight = panel.height * cover
  return { x: (width - rectWidth) / 2, y: (height - rectHeight) / 2, width: rectWidth, height: rectHeight }
}

// StoryCamera.MoveCamera at camera (x, y) canvas units and zoom: the actor layer scales by zoom about the view
// centre and follows the camera; ResizeCamera only grows the background panel when the view widens, so the
// background scales by max(1, zoom) with the same shift.
export function cameraScreenTransform(width, height, { zoom = 1, x = 0, y = 0 } = {}) {
  const unit = advStageUnit(width, height)
  const shiftX = -x * unit * zoom, shiftY = y * unit * zoom
  const bgScale = Math.max(1, zoom)
  return {
    scale: zoom, x: width / 2 * (1 - zoom) + shiftX, y: height / 2 * (1 - zoom) + shiftY,
    bgScale, bgX: width / 2 * (1 - bgScale) + shiftX, bgY: height / 2 * (1 - bgScale) + shiftY,
  }
}
