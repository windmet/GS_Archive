import assert from 'node:assert/strict'
import vm from 'node:vm'
import { parse } from '@vue/compiler-sfc'
import { parse as parseScript } from '@babel/parser'
import { computed, ref, reactive, watch, nextTick, effectScope, unref } from 'vue'
import { criticalPreloadProgress } from '../../src/presentation/LoadingPresentation.js'

// Extract executable production expressions, never a replacement decision tree.
function sfc(text) {
  const { descriptor, errors } = parse(text)
  assert.deepEqual(errors, [])
  const script = descriptor.scriptSetup.content
  const body = parseScript(script, { sourceType: 'module' }).program.body
  const variables = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
  const nodes = [], parents = new Map()
  function visit(node) { if (node.type === 1) nodes.push(node); for (const child of node.children || []) { parents.set(child, node); visit(child) } }
  visit(descriptor.template.ast)
  return {
    nodes, parents,
    expression(name, state) {
      const declaration = variables.find(node => node.id.name === name)
      assert.ok(declaration?.init, `Missing production declaration: ${name}`)
      return vm.runInNewContext(script.slice(declaration.init.start, declaration.init.end), state)
    },
    setup: body.filter(node => node.type !== 'ImportDeclaration').map(node => script.slice(node.start, node.end)).join('\n'),
  }
}
function directive(node, name, argument) {
  const prop = node.props.find(prop => prop.type === 7 && prop.name === name && (!argument || prop.arg?.content === argument))
  assert.ok(prop?.exp, `Missing ${name}:${argument || ''} on ${node.tag}`)
  return prop.exp.content
}
const evaluate = (expression, state) => vm.runInNewContext(expression, Object.fromEntries(Object.entries(state).map(([key, value]) => [key, unref(value)])))

export async function verifyLoadingBehavior({ source, render, LoadingScreen }) {
  const app = sfc(source('App.vue'))
  const state = { computed, playbackBuffering: ref(false), view: ref('cards'), loadingPurpose: ref('archive-data'),
    loading: ref(true), archiveComponentPending: ref(false) }
  state.hardLoading = app.expression('hardLoading', state)
  state.routePending = app.expression('routePending', state)
  state.loadingMessage = app.expression('loadingMessage', state)
  for (const [view, purpose, buffering, message, hard, pending] of [
    ['cards', 'archive-data', false, '正在读取资料馆数据…', false, true],
    ['__boot__', 'archive-data', false, '正在读取资料馆数据…', true, false],
    ['chibi_stage', 'stage', false, '正在准备舞台…', true, false],
    ['player', 'archive-data', false, '正在准备演出…', false, true],
    ['cards', 'story-playback', false, '正在准备演出…', true, false],
    ['cards', 'archive-data', true, '正在准备演出…', false, true],
  ]) {
    state.view.value = view; state.loadingPurpose.value = purpose; state.playbackBuffering.value = buffering
    assert.equal(state.loadingMessage.value, message)
    assert.equal(state.hardLoading.value, hard)
    assert.equal(state.routePending.value, pending)
  }
  state.loading.value = false; state.archiveComponentPending.value = true
  assert.equal(state.hardLoading.value, false)
  assert.equal(state.routePending.value, true, 'lazy component loading still has a pending notice')

  const curtains = app.nodes.filter(node => node.tag === 'LoadingScreen')
  assert.equal(curtains.length, 2, 'player shell and archive fallback own separate curtains')
  for (const curtain of curtains) {
    const isFallback = curtain.props.some(prop => prop.type === 7 && prop.name === 'if')
    let closed = 0
    const context = { pickerPreparing: false, hardLoading: true, playbackBuffering: false,
      view: 'cards', loading: true, playbackReadiness: { status: 'loading' }, preloadStatus: { tasks: [] },
      loadingMessage: '真实调用方消息', playerSessionOpen: false,
      playbackController: { pendingEntry: ref(null), close: () => closed++ } }
    const visible = () => evaluate(directive(curtain, 'bind', 'visible'), context)
    assert.equal(visible(), true)
    context.pickerPreparing = true; assert.equal(visible(), false)
    context.pickerPreparing = false; context.hardLoading = false; assert.equal(visible(), false)
    context.playbackBuffering = true; assert.equal(visible(), true)
    context.view = 'player'; context.loading = false; context.playbackReadiness = { status: 'waiting', hasFrame: true }
    assert.equal(visible(), false, 'an already visible frame must not be covered while buffering')
    context.playbackReadiness.hasFrame = false; assert.equal(visible(), true)
    if (isFallback) {
      context.view = 'reader'; assert.equal(visible(), false)
      assert.equal(evaluate(directive(curtain, 'if'), context), true)
      context.playerSessionOpen = true; assert.equal(evaluate(directive(curtain, 'if'), context), false)
    }
    for (const [prop, expected] of [['message', context.loadingMessage], ['status', context.preloadStatus], ['readiness', context.playbackReadiness]]) {
      assert.equal(evaluate(directive(curtain, 'bind', prop), context), expected)
    }
    context.playbackBuffering = false
    assert.equal(evaluate(directive(curtain, 'bind', 'can-cancel'), context), false)
    context.playbackController.pendingEntry.value = {}
    assert.equal(evaluate(directive(curtain, 'bind', 'can-cancel'), context), true)
    evaluate(directive(curtain, 'on', 'cancel'), context)
    assert.equal(closed, 1)
    const html = await render(LoadingScreen, { visible: true, message: evaluate(directive(curtain, 'bind', 'message'), context) })
    assert.ok(html.includes(context.loadingMessage))
  }

  const pendingIndicators = app.nodes.filter(node => node.tag === 'GsLoadingIndicator' && node.props.some(prop => prop.type === 7 && prop.name === 'if'))
  assert.equal(pendingIndicators.length, 2)
  for (const indicator of pendingIndicators) {
    const insideSlot = app.parents.get(indicator)?.tag === 'template'
    for (const shellVisible of [false, true]) {
      assert.equal(evaluate(directive(indicator, 'if'), { routePending: false, archiveShellVisible: shellVisible }), false)
      assert.equal(evaluate(directive(indicator, 'if'), { routePending: true, archiveShellVisible: shellVisible }), insideSlot || !shellVisible)
    }
    if (insideSlot) assert.equal(evaluate(directive(indicator, 'bind', 'message'), { routePendingMessage: '正在打开歌曲…' }), '正在打开歌曲…')
    else assert.equal(indicator.props.find(prop => prop.name === 'message')?.value?.content, '正在准备下一页…')
  }

  // Run the actual setup with Vue reactivity and a deterministic clock. The
  // lifecycle registration and clock are host boundaries; timer logic is production.
  const loading = sfc(source('components/LoadingScreen.vue'))
  const props = reactive({ visible: true, canCancel: true, status: null, readiness: null, message: 'test' })
  const timers = new Map(), unmounted = []
  let timerId = 0
  const host = { computed, ref, watch, criticalPreloadProgress, window: {},
    defineProps: () => props, defineEmits: () => {}, onUnmounted: callback => unmounted.push(callback),
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id },
    clearTimeout: id => timers.delete(id) }
  const scope = effectScope()
  try {
    const slow = scope.run(() => vm.runInNewContext(`${loading.setup}\nslow`, host))
    assert.equal(timers.size, 1); assert.equal([...timers.values()][0].delay, 8000)
    assert.equal(slow.value, false)
    const [id, timer] = [...timers][0]; timers.delete(id); timer.callback()
    assert.equal(slow.value, true)
    props.visible = false; await nextTick(); assert.equal(slow.value, false); assert.equal(timers.size, 0)
    props.visible = true; await nextTick(); assert.equal(timers.size, 1)
    unmounted.forEach(callback => callback()); assert.equal(timers.size, 0, 'unmount cancels the slow notice timer')
    let cancelled = 0
    const button = loading.nodes.find(node => node.tag === 'button')
    evaluate(directive(button, 'on', 'click'), { $emit: event => { assert.equal(event, 'cancel'); cancelled++ } })
    assert.equal(cancelled, 1)
    const slowNotice = loading.nodes.find(node => node.tag === 'p' && node.props.some(prop => prop.name === 'if' && prop.exp?.content === 'slow'))
    assert.ok(slowNotice)
    const noticeExpression = slowNotice.children.find(child => child.type === 5)?.content.content
    assert.ok(noticeExpression)
    assert.equal(evaluate(noticeExpression, { canCancel: true }), '加载较慢，可继续等待，或取消后重试。')
    assert.equal(evaluate(noticeExpression, { canCancel: false }), '加载较慢，可继续等待。')
  } finally { scope.stop() }

  const reader = sfc(source('components/archive/ArchiveStoryReader.vue'))
  const readerState = { computed, localization: { loading: ref(true), diagnostics: ref({ code: 'translation_invalid' }) },
    fallbackCount: ref(3), props: reactive({ mode: 'translation' }) }
  readerState.translationLoadFailed = reader.expression('translationLoadFailed', readerState)
  const notice = reader.expression('translationStatus', readerState)
  assert.equal(notice.value, '正在读取译文…')
  readerState.localization.loading.value = false
  assert.equal(notice.value, '译文暂时无法载入，当前显示原文。')
  readerState.localization.diagnostics.value = null
  assert.equal(notice.value, '3 处暂无可用译文，已显示原文。')
  readerState.fallbackCount.value = 0; assert.equal(notice.value, '当前显示译文。')
  readerState.props.mode = 'bilingual'; assert.equal(notice.value, '当前显示原文与译文。')

  const story = sfc(source('core/StoryViewer.vue'))
  const storyState = { computed, initialReadyEmitted: ref(false), runtimeReadinessStatus: ref('waiting'),
    frameHolding: ref(false), frameHoldRequired: ref(false) }
  const buffering = story.expression('localBuffering', storyState)
  assert.equal(buffering.value, false)
  storyState.initialReadyEmitted.value = true; assert.equal(buffering.value, true)
  storyState.frameHoldRequired.value = true; assert.equal(buffering.value, false)
  storyState.frameHolding.value = true; assert.equal(buffering.value, true)
  storyState.runtimeReadinessStatus.value = 'ready'; assert.equal(buffering.value, false)
  const localIndicator = story.nodes.find(node => node.tag === 'GsLoadingIndicator' &&
    node.props.some(prop => prop.name === 'class' && prop.value?.content === 'local-buffering'))
  assert.ok(localIndicator)
  assert.equal(evaluate(directive(localIndicator, 'if'), { localBuffering: true, HIDE_UI: false }), true)
  assert.equal(evaluate(directive(localIndicator, 'if'), { localBuffering: true, HIDE_UI: true }), false)
  assert.equal(evaluate(directive(localIndicator, 'bind', 'message'), {
    localBufferingText: story.expression('localBufferingText', {}),
  }), '正在准备下一段画面…')

  for (const [name, flag, initialMessage] of [
    ['SpineViewer', 'loading', '正在准备舞台…'],
    ['ChibiStageViewer', 'booting', '正在读取多人舞台资源…'],
  ]) {
    const stage = sfc(source(`components/${name}.vue`))
    const indicator = stage.nodes.find(node => node.tag === 'GsLoadingIndicator')
    assert.ok(indicator)
    const container = stage.parents.get(indicator)
    assert.equal(evaluate(directive(container, 'if'), { [flag]: true }), true)
    assert.equal(evaluate(directive(container, 'if'), { [flag]: false }), false)
    const message = stage.expression('statusText', { ref })
    assert.equal(evaluate(directive(indicator, 'bind', 'message'), { statusText: message }), initialMessage)
    message.value = '资源读取进度'
    assert.equal(evaluate(directive(indicator, 'bind', 'message'), { statusText: message }), '资源读取进度')
    const error = stage.nodes.find(node => node.props.some(prop => prop.name === 'class' && prop.value?.content === 'stage-state error-state'))
    assert.ok(error)
    assert.equal(evaluate(directive(error, 'else-if'), { errorText: 'failed' }), 'failed')
    assert.equal(evaluate(directive(error, 'else-if'), { errorText: '' }), '')
  }
}
