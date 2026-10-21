import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { resolveStoryPlaybackWindow } from '../shared/story/StoryPlaybackWindow.js'
import { ref } from 'vue'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { bindStoryNavigation } from './lib/story-navigation-harness.mjs'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
// A whole-file entry (no range) plays the whole group from the formal title. Passing a startStep merely to skip
// the synopsis also selects an episode boundary and would truncate the group.
{
  const steps=[{type:'synopsis'},{type:'title'},{type:'adv'},{type:'synopsis'},{type:'adv'}]
  const scenario={steps,episodes:[{start_step_id:1,end_step_id:3},{start_step_id:4,end_step_id:5}]}
  const window=resolveStoryPlaybackWindow(scenario,{})
  assert.equal(window.startIndex,1)
  assert.equal(steps[window.entryIndex].type,'title','formal title must remain playable')
  assert.equal(window.endIndex,4,'a whole-file entry must keep the whole group, not only the first episode')
  assert.equal(steps[3].type,'synopsis','nonleading authored synopsis is not globally filtered')
  assert.equal(resolveStoryPlaybackWindow({steps:[{type:'adv'}]},{}).entryIndex,0)
}
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const jobs = new Map(), commits = [], errors = [], opened = []
  const navigation = createArchiveNavigationCoordinator()
  const context = vm.createContext({
    storyReadModelStatus: { value: '' }, loading: { value: false },
    navigation,
    storyReadModelCatalog: ref(['old.json', 'current.json', 'retry.json'].map(file => ({ id: file, file, title: file, detail: { url: file } }))),
    readModelClient: { load: (descriptor, options) => {
      const job = deferred(); jobs.set(descriptor.url, job)
      return job.promise.then(detail => { options.validate(detail); return detail })
    } },
    openEventDetail: (...args) => { opened.push(args) },
    captureDetailSource: () => {},
    commitView: view => { navigation.invalidate(); commits.push(view); context.loading.value = false },
  })
  bindStoryNavigation(app, context).stop()
  return { context, jobs, commits, errors, opened, invalidate: navigation.invalidate }
}
// A story link opens the page that owns the story (core/StoryOwner.js; the story navigation verifier covers every
// owner). When the link alone does not say which page that is, the story is read first; these are the load races.
const view = { related: [], castReferences: [], promotedVisualUrl: '', readingEntries: [] }
const eventStory = file => ({ story: { file, domain: 'event', eventRelation: { event_id: 410001 } }, view })
const unowned = file => ({ story: { file, domain: 'unowned' }, view })
{
  const t = setup()
  t.context.openStoryDetail({ file: 'event.json', domain: 'event', eventRelation: { event_id: 410002 } }, 'portal')
  assert.deepEqual(t.opened, [[{ event_id: '410002' }, 'portal']], 'an owner the link names opens without a read')
  assert.equal(t.jobs.size, 0)
}
{
  const t = setup()
  const old = t.context.openStoryDetail({ file: 'old.json' })
  const current = t.context.openStoryDetail({ file: 'current.json' }, 'external_story_resources')
  t.jobs.get('current.json').resolve(eventStory('current.json')); await current
  t.jobs.get('old.json').resolve(eventStory('old.json')); await old
  assert.deepEqual(t.opened, [[{ event_id: '410001' }, 'external_story_resources']], 'only the latest link opens its owner')
}
{
  const t = setup()
  const stale = t.context.openStoryDetail({ file: 'old.json' })
  t.invalidate()
  t.jobs.get('old.json').resolve(eventStory('old.json')); await stale
  assert.deepEqual(t.opened, [])
}
{
  const t = setup()
  const lost = t.context.openStoryDetail({ file: 'old.json' })
  t.jobs.get('old.json').resolve(unowned('old.json')); await lost
  assert.deepEqual([t.opened, t.commits, t.context.loading.value], [[], [], false])
  assert.match(t.context.storyReadModelStatus.value, /没有所属页面/, 'a story no page owns leaves the visitor in place with a notice')
}
{
  const t = setup()
  const failed = t.context.openStoryDetail({ file: 'retry.json' })
  const previousError = console.error
  try { console.error = (...args) => t.errors.push(args); t.jobs.get('retry.json').reject(new Error('network')); await failed }
  finally { console.error = previousError }
  assert.deepEqual(t.opened, [])
  assert.match(t.context.storyReadModelStatus.value, /重试/)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openStoryDetail({ file: 'retry.json' })
  t.jobs.get('retry.json').resolve(eventStory('retry.json')); await retry
  assert.deepEqual(t.opened, [[{ event_id: '410001' }, 'story_catalog']])
}
console.log('Story read-model navigation: whole-file window, owner from the link, latest link, supersession, no-owner notice and retry passed')
