import layout from './studio-native-frame-anchors.json' with { type: 'json' };
import native from './studio-native-frame-sprites.json' with { type: 'json' };

// Source thumbnails assign _01 to LeftFrame (upper right), _02 to RightFrame
// (lower left). StudioRoot.AddFrame sets localScale one and SetNativeSize, so a
// part is drawn at its Sprite rect, 1:1 on the 1280 × 720 studio canvas.
export function studioFramePlacement(index, width, height) {
  const name = ['LeftFrame', 'RightFrame'][index],
    rect = layout.placements[name];
  if (!rect || !(width > 0 && height > 0)) throw Error('Invalid studio frame placement');
  if (rect.m_AnchorMin.x !== rect.m_AnchorMax.x || rect.m_AnchorMin.y !== rect.m_AnchorMax.y)
    throw Error('Stretch frame anchors require a size contract');
  return {
    x: rect.m_AnchorMin.x * width + rect.m_AnchoredPosition.x,
    y: (1 - rect.m_AnchorMin.y) * height - rect.m_AnchoredPosition.y,
    anchorX: rect.m_Pivot.x,
    anchorY: 1 - rect.m_Pivot.y,
  };
}

// The native rect of a part, and where an archived file's pixels sit inside it: a
// file the size of the rect is drawn as is, one holding only the packed region at
// that region's offset.
export function studioFrameSprite(url, fileWidth, fileHeight) {
  const name = String(url || '').match(/(image_picturestudio_frame_\d{4}_0[12])(?!\d)/)?.[1],
    sprite = native.sprites[name];
  if (!sprite) throw Error(`Unknown studio frame part: ${url}`);
  const { width, height, packed } = sprite;
  if (fileWidth === width && fileHeight === height) return { width, height, trim: null };
  if (Math.abs(fileWidth - packed.width) >= 1 || Math.abs(fileHeight - packed.height) >= 1)
    throw Error(`Studio frame part ${name} is ${fileWidth} × ${fileHeight}, neither its rect nor its packed region`);
  return { width, height, trim: { x: packed.x, y: packed.y, width: fileWidth, height: fileHeight } };
}
