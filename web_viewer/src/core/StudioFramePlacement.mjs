import layout from './studio-native-frame-anchors.json' with { type: 'json' };

// Source thumbnails assign _01 to LeftFrame (upper right), _02 to RightFrame
// (lower left). Dimensions are set at runtime in Unity and remain approximate.
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
