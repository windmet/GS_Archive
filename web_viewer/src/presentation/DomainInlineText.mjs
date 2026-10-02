// Safe text parts; no HTML interpolation. Unknown markers remain available for inspection.
export function domainInlineParts(text) {
  return String(text || '').split(/(\[stamina\])/g).filter(Boolean).map(text =>
    text === '[stamina]' ? {kind:'stamina'} : {kind:'text',text});
}
