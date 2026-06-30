export function normalizeFileList(files) {
  if (Array.isArray(files)) return files
  if (typeof files === 'string') return files.trim().split(/\s+/).filter(Boolean)
  return []
}

export function groupFileList(group, seen = new Set()) {
  if (!group || seen.has(group)) return []
  seen.add(group)

  const ownFiles = normalizeFileList(group.files)
  if (ownFiles.length) return ownFiles

  if (Array.isArray(group.groups)) {
    return group.groups.flatMap(child => groupFileList(child, seen))
  }

  return []
}

export function groupFileCount(group) {
  return groupFileList(group).length
}
