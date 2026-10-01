import rendering from '../../config/song-note-rendering.v1.json' with { type: 'json' }
export const noteRendering = rendering
export function songNoteRole(type) {
  if (type === 'END_NORMAL') return 'normal'
  if (type?.startsWith('END_FLICK_')) return `swipe_${type.slice(10).toLowerCase()}`
  const role = rendering.mapping[type]
  if (!role) throw new Error(`Unknown note appearance: ${type}`)
  return role
}
export function songNoteEndpoints(chart) {
  return chart.notes.flatMap(n => {
    const points = n.poly?.length ? n.poly : [{ posx: n.start }, { posx: n.end }]
    const head = { id: `${n.sourceIndex}-head`, sourceIndex: n.sourceIndex, endpoint: 'head', tick: n.tick, lane: points[0].posx, role: songNoteRole(n.type) }
    return n.duration ? [head, { id: `${n.sourceIndex}-tail`, sourceIndex: n.sourceIndex, endpoint: 'tail', tick: n.tick + n.duration, lane: points.at(-1).posx, role: songNoteRole(n.endtype || 'END_NORMAL') }] : [head]
  }).sort((a, b) => a.tick - b.tick || a.lane - b.lane)
}
export function songSimultaneousLinks(chart) {
  const groups = new Map()
  for (const note of songNoteEndpoints(chart)) {
    if (note.role === 'sp') continue
    const group = groups.get(note.tick) || []
    group.push(note); groups.set(note.tick, group)
  }
  return [...groups.entries()].flatMap(([tick, notes]) => {
    const lanes = [...new Set(notes.map(n => n.lane))].sort((a, b) => a - b)
    return lanes.length > 1 ? [{ tick, from: lanes[0], to: lanes.at(-1), noteIds: notes.map(n => n.id) }] : []
  })
}

// Export the rendered snapshot with verified PNGs embedded, including the
// native chevron cells. Standalone SVGs must work without the local server.
export async function embedSongChartImages(svg, fetcher = fetch) {
  const snapshot = svg.cloneNode(true)
  const urls = [...new Set([...snapshot.querySelectorAll('image')].map(im => im.getAttribute('href')))]
  const embedded = new Map()
  await Promise.all(urls.map(async url => {
    const expected = rendering.assets[url]
    if (!expected) throw new Error('导出含有未核实的贴图地址')
    const response = await fetcher(url)
    if (!response.ok) throw new Error(`贴图加载失败（${response.status}）`)
    const bytes = await response.arrayBuffer()
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('')
    if (bytes.byteLength !== expected.bytes || hash !== expected.sha256) throw new Error('贴图校验失败')
    const value = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject
      reader.readAsDataURL(new Blob([bytes], { type: 'image/png' }))
    })
    embedded.set(url, value)
  }))
  const namespace = 'http://www.w3.org/2000/svg'
  const defs = snapshot.ownerDocument.createElementNS(namespace, 'defs')
  const ids = new Map()
  for (const im of [...snapshot.querySelectorAll('image')]) {
    const url = im.getAttribute('href')
    if (!ids.has(url)) {
      const id = `export-note-asset-${ids.size}`
      const source = snapshot.ownerDocument.createElementNS(namespace, 'image')
      source.setAttribute('id', id); source.setAttribute('href', embedded.get(url))
      source.setAttribute('width', im.getAttribute('width')); source.setAttribute('height', im.getAttribute('height'))
      defs.appendChild(source); ids.set(url, id)
    }
    const use = snapshot.ownerDocument.createElementNS(namespace, 'use')
    for (const attribute of im.attributes) if (attribute.name !== 'href') use.setAttribute(attribute.name, attribute.value)
    use.setAttribute('href', `#${ids.get(url)}`); im.replaceWith(use)
  }
  snapshot.prepend(defs)
  return new XMLSerializer().serializeToString(snapshot)
}
