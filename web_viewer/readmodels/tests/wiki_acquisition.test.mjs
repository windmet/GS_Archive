import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { readCheckout } from '../lib/checkout_adapter.mjs'
import { eventMissionLabel, songMissionLabel } from '../lib/wiki_acquisition.mjs'

const viewer = fileURLToPath(new URL('../..', import.meta.url))

test('mission conditions translate only the known wiki patterns', () => {
  assert.equal(eventMissionLabel('イベント楽曲のライブを累計5回クリアしよう'), '活动限时任务：活动曲 LIVE 累计通关 5 次')
  assert.equal(eventMissionLabel('イベント楽曲のライブを5回クリアしよう'), '活动限时任务：活动曲 LIVE 通关 5 次')
  assert.equal(songMissionLabel('『Not Alone』をオリジナルメンバーで1回クリアしよう'), '以原版成员通关『Not Alone』1 次')
  assert.throws(() => eventMissionLabel('ログインしよう'))
})

test('[local-corpus] wiki listings confirm gasha pickups and card acquisition', async () => {
  const { product } = await readCheckout(viewer, { dataRevision: 'test', mediaEpoch: 'test' })
  const contexts = Object.entries(product.cardContext)
  const gasha = contexts.filter(([, context]) => context.gashaRelation)
  // Every derived pickup is now wiki-listed; the ticket-only pools add their own cards.
  assert.equal(gasha.filter(([, context]) => context.gashaRelation.evidence_level !== 'curated').length, 0)
  const ticket = gasha.filter(([, context]) => String(context.gashaRelation.announcement_id).startsWith('ticket-'))
  assert.equal(ticket.length, 15 + 147)
  assert.equal(product.cardContext['007kei_r02'].acquisition.events[0].methods[0].kind, 'exchange')
  assert.equal(product.cardContext['029ass_r02'].acquisition.events[0].methods[0].kind, 'mission')
  assert.equal(product.cardContext['048mom_sr08'].acquisition.mission.label, '以原版成员通关『Not Alone』1 次')
  const confirmed = product.gashas.filter(row => row.wiki_confirmation)
  assert.equal(confirmed.length, 57)
})
