const warmedStates = new Set(['image-loaded', 'fetched', 'atlas-parsed', 'json-parsed'])
export function criticalPreloadProgress(status) {
  const tasks = (status?.tasks || []).filter(task => task.priority === 'critical' && task.required !== false && !['excluded', 'deferred'].includes(task.state))
  return { total: tasks.length, ready: tasks.filter(task => warmedStates.has(task.state)).length }
}
