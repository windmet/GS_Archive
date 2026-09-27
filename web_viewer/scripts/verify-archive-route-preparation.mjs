import assert from 'node:assert/strict'
import { prepareArchiveRoute } from '../src/core/prepareArchiveRoute.js'
import { reflowArchiveText } from '../src/presentation/ArchiveText.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { resolve, reject, promise }
}
for (const first of ['data', 'component']) {
  const data = deferred(), component = deferred()
  let published = false, started = false
  const ready = prepareArchiveRoute({ cards: () => { started = true; return component.promise } }, 'cards', data.promise)
    .then(result => { published = true; return result })
  assert.equal(started, true)
  const jobs = { data, component }
  jobs[first].resolve('first')
  await Promise.resolve(); await Promise.resolve()
  assert.equal(published, false, 'old page must remain until both dependencies are ready')
  jobs[first === 'data' ? 'component' : 'data'].resolve('second')
  assert.equal(await ready, first === 'data' ? 'first' : 'second')
}
{
  const component = deferred(), navigation = createArchiveNavigationCoordinator()
  const commits = []
  const old = navigation.run(async intent => {
    await prepareArchiveRoute({ cards: () => component.promise }, 'cards', Promise.resolve())
    if (intent.isCurrent()) commits.push('cards')
  })
  await navigation.run(async intent => { if (intent.isCurrent()) commits.push('portal') })
  component.resolve()
  await old
  assert.deepEqual(commits, ['portal'])
}
await assert.rejects(prepareArchiveRoute({ cards: () => Promise.reject(new Error('chunk unavailable')) }, 'cards', Promise.resolve()), /chunk unavailable/)
{
  const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  const handler = app.match(/function prepareArchivePage\([^]*?\n\}/)[0]
  const statuses = Object.fromEntries([...new Set(handler.match(/\b\w+ReadModelStatus\b/g))]
    .map(name => [name, { value: '正在读取旧页面…' }]))
  const context = vm.createContext({ ...statuses, prepareArchiveRoute, archiveRouteLoaders: { cards: async () => {} } })
  vm.runInContext(handler, context)
  assert.equal(await context.prepareArchivePage('cards', Promise.resolve('cards')), 'cards')
  assert.ok(Object.values(statuses).every(status => status.value === ''), 'superseded progress must not linger on the new page')
}
assert.equal(reflowArchiveText('今日も\r\n頑張ろう！\r\n\r\nよろしく。'), '今日も頑張ろう！\n\nよろしく。')
assert.equal(reflowArchiveText('Hello\nworld!'), 'Hello world!')
assert.equal(reflowArchiveText('315\nプロダクション'), '315プロダクション')
assert.equal(reflowArchiveText('一段\n \n二段'), '一段\n\n二段')
assert.equal(reflowArchiveText(null), '')
console.log('Route preparation: parallel readiness, stale intent, chunk errors; mobile paragraph reflow passed')
