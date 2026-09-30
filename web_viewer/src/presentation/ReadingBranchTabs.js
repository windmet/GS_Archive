/** Group references to canonical rows. Search still indexes every source row. */
export function readingBranchTree(rows = []) {
  const root = [], groups = new Map(), currentOptions = new Map()
  for (const item of rows) {
    const branch = item.branch
    if (!branch) { root.push({ kind: 'row', item }); continue }
    let group = groups.get(branch.choice)
    if (!group) {
      group = { kind: 'branch', choice: branch.choice, key: item.row.anchor.row_id, options: [] }
      groups.set(branch.choice, group)
      const parent = groups.get(branch.parent)
      const destination = parent ? parent.options[currentOptions.get(branch.parent)].nodes : root
      destination.push(group)
    }
    currentOptions.set(branch.choice, branch.index)
    const option = group.options[branch.index] ||= { index: branch.index, choice: null, nodes: [], shared: branch.shared, terminal: branch.terminal }
    if (item.row.kind === 'choice' && item.row.anchor.step_id === branch.choice) option.choice = item
    else option.nodes.push({ kind: 'row', item })
  }
  return root
}

/** Reveal every enclosing choice, including nested branches and old aliases. */
export function readingBranchAnchorPath(nodes, anchor, path = []) {
  if (!anchor) return null
  const matches = item => item?.row.anchor.row_id === anchor || item?.anchorAliases?.includes(anchor)
  for (const node of nodes) {
    if (node.kind === 'row') { if (matches(node.item)) return path; continue }
    for (const option of node.options) {
      const next = [...path, { choice: node.choice, index: option.index }]
      if (matches(option.choice)) return next
      const nested = readingBranchAnchorPath(option.nodes, anchor, next)
      if (nested) return nested
    }
  }
  return null
}
