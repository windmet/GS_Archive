import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readingBranchTree, readingBranchAnchorPath } from '../src/presentation/ReadingBranchTabs.js'
import { projectReadingChoiceRows } from '../src/presentation/ReadingChoiceMetadata.js'

const read = file => JSON.parse(readFileSync(new URL(`../public/data/reading/${file}`, import.meta.url)))
const manifest = read('manifest.json')
let forks = 0, nested = 0, aliases = 0
for (const entry of manifest.entries.filter(entry => entry.status === 'ready')) {
  const doc = read(entry.file), projected = projectReadingChoiceRows(doc), tree = readingBranchTree(projected)
  const visited = []
  function visit(nodes, path = []) {
    for (const node of nodes) {
      if (node.kind === 'row') {
        visited.push(node.item)
        assert.deepEqual(readingBranchAnchorPath(tree, node.item.row.anchor.row_id), path)
        for (const alias of node.item.anchorAliases) {
          assert.deepEqual(readingBranchAnchorPath(tree, alias), path); aliases++
        }
        continue
      }
      forks++; if (path.length) nested++
      const control = doc.controls.find(control => control.step_id === node.choice)
      assert.equal(node.options.length, control.options.length)
      for (const option of node.options) {
        assert.ok(option.choice, `${doc.document_id}: every tab has its canonical option label`)
        const route = [...path, {choice:node.choice,index:option.index}]
        visited.push(option.choice)
        assert.deepEqual(readingBranchAnchorPath(tree, option.choice.row.anchor.row_id), route)
        for (const alias of option.choice.anchorAliases) {
          assert.deepEqual(readingBranchAnchorPath(tree, alias), route); aliases++
        }
        visit(option.nodes, route)
      }
    }
  }
  visit(tree)
  assert.equal(visited.length, projected.length, `${doc.document_id}: missing ${projected.filter(item=>!visited.includes(item)).map(item=>item.row.anchor.row_id)}`)
  assert.equal(new Set(visited.map(item => item.row.anchor.row_id)).size, projected.length)
  assert.deepEqual(new Set(visited.map(item => item.row)), new Set(projected.map(item => item.row)), 'grouping preserves all source references exactly once')
  assert.equal(readingBranchAnchorPath(tree, 'missing'), null)
}
const item = (id, kind, choice, index, parent = null) => ({row:{kind,anchor:{row_id:id,step_id:kind==='choice'?choice:99}},branch:{choice,index,parent},anchorAliases:[]})
const outer = item('outer-0','choice',1,0)
const inner0 = item('inner-0','choice',2,0,1), inner1 = item('inner-1','choice',2,1,1)
const reply = item('nested-reply','dialogue',2,1,1)
const tree = readingBranchTree([outer,inner0,inner1,reply,item('outer-1','choice',1,1)])
assert.deepEqual(readingBranchAnchorPath(tree,'nested-reply'),[{choice:1,index:0},{choice:2,index:1}], 'hidden nested reply reveals both selections')
assert.equal(tree[0].options[0].nodes[0].choice,2)
console.log(`Reading choice tabs: ${forks} forks / ${nested} nested / ${aliases} metadata aliases; canonical row conservation and every hidden anchor path verified`)
