// Control style census for capture-gallery --styles: samples the computed style of every visible
// control by role, so the same control drawn differently on two pages shows up as two signatures.
// The page expression runs in the browser; summarizeControlStyles groups the samples afterwards.

// Role -> selector. Text and icon buttons are split in the page by whether they carry text.
export const CONTROL_ROLES = {
  button: 'button:not([role=tab]), [role=button]:not([role=tab])',
  tab: '[role=tab]',
  search: 'input[type=search]',
  field: 'input[type=text], input:not([type]), textarea',
  select: 'select',
  heading1: 'h1',
  heading2: 'h2',
  heading3: 'h3',
  dialog: 'dialog[open], [role=dialog]',
}

// Properties that define how a role looks; layout-only properties stay out of the signature.
const PROPS = ['fontSize', 'fontWeight', 'borderRadius', 'backgroundColor', 'color', 'borderTopWidth', 'borderTopColor', 'paddingTop', 'paddingLeft']

export const controlStyleExpression = `(() => {
  const roles = ${JSON.stringify(CONTROL_ROLES)}, props = ${JSON.stringify(PROPS)}
  const out = []
  for (const [role, selector] of Object.entries(roles)) {
    for (const element of document.querySelectorAll(selector)) {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
      if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') continue
      const text = (element.innerText || element.value || '').trim()
      const kind = role === 'button' ? (text ? 'text-button' : 'icon-button') : role
      const sample = { role: kind, height: Math.round(rect.height), width: role === 'dialog' ? Math.round(rect.width) : undefined,
        cls: [...element.classList].slice(0, 2).join('.'), text: text.slice(0, 24) }
      for (const prop of props) sample[prop] = style[prop]
      out.push(sample)
    }
  }
  return out
})()`

// Height is part of a control's look; for headings and dialogs it follows content, so leave it out.
const SIZED = new Set(['text-button', 'icon-button', 'tab', 'search', 'field', 'select'])
export function controlSignature(sample) {
  return [SIZED.has(sample.role) ? `h${sample.height}` : '', sample.role === 'dialog' ? `w${sample.width}` : '',
    ...PROPS.map(prop => sample[prop])].filter(Boolean).join(' | ')
}

// entries: [{ scene, width, samples }] -> per role, signatures sorted by how many scenes use them.
export function summarizeControlStyles(entries) {
  const roles = {}
  for (const { scene, width, samples } of entries) {
    for (const sample of samples || []) {
      const signature = controlSignature(sample)
      const role = roles[sample.role] ||= {}
      const group = role[signature] ||= { signature, count: 0, scenes: new Set(), examples: new Set() }
      group.count++
      group.scenes.add(`${scene}@${width}`)
      if (group.examples.size < 4) group.examples.add(sample.cls || sample.text || '(none)')
    }
  }
  return Object.fromEntries(Object.entries(roles).map(([role, groups]) => [role, Object.values(groups)
    .map(group => ({ ...group, scenes: [...group.scenes], examples: [...group.examples] }))
    .sort((a, b) => b.scenes.length - a.scenes.length || b.count - a.count)]))
}
