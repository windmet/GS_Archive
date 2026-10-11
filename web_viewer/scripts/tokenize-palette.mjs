// Maps the archive's recurring private colours onto GS_UI_TOKENS inside component <style>
// blocks (or whole .css files). Only near-identical shades of one role are mapped, so a run
// is a consistency pass, not a redesign. Usage: node scripts/tokenize-palette.mjs <file>... [--write]
import fs from 'node:fs'

const ROLES = {
  'var(--gs-paper)': ['#f7f9fa', '#f5f7f8', '#f8fafb', '#f6f8f9'],
  'var(--gs-ink)': ['#26313a', '#18212b', '#24313a', '#29383f', '#222', '#222222', '#233039', '#263941', '#26343c', '#283d43', '#293b45', '#2d4551'],
  'var(--gs-ink-2)': ['#5c6771', '#596d7c', '#4f5b64', '#46535c', '#4a545e', '#4c5c64', '#52616a', '#536d7a', '#4d5c64'],
  'var(--gs-ink-3)': ['#7a858e', '#8a949e', '#9aa4ad', '#7b858e', '#68727d', '#7d898f', '#748089', '#75808a', '#71838a', '#7a858c', '#6f7e85', '#929ca1', '#888', '#888888', '#777', '#777777', '#69747e', '#9ca5ad', '#8e9aa1'],
  'var(--gs-line)': ['#dfe4e8', '#d7dde2', '#e0e5e8', '#e5e9ec', '#e1e6e8', '#dfe5e7', '#dfe5e8', '#e2e7ea', '#edf0f2', '#e8e8e8', '#eee', '#eeeeee', '#f0f0f0'],
  'var(--gs-mint-ink)': ['#158f87', '#168f87', '#16978e', '#15978e', '#177f78', '#176f69', '#147f77', '#168a82', '#17877f', '#147c75', '#167e77', '#157e71', '#137b75', '#168b83', '#118a86', '#1e7a70'],
  'var(--gs-mint-wash)': ['#eaf8f6', '#eef8f7', '#f0fbfa', '#e9f7f5', '#e8f6f4', '#f1faf9', '#e7f6f4', '#edf9f8', '#eaf6f4', '#f2fbfa'],
}
const lookup = new Map(Object.entries(ROLES).flatMap(([token, shades]) => shades.map(hex => [hex.toLowerCase(), token])))
const write = process.argv.includes('--write')
let total = 0
for (const file of process.argv.slice(2).filter(arg => !arg.startsWith('--'))) {
  const source = fs.readFileSync(file, 'utf8')
  const at = file.endsWith('.vue') ? source.indexOf('<style') : 0
  if (at < 0) continue
  let count = 0
  // Hex literals only in declarations, never inside url(...) or selectors.
  const css = source.slice(at).replace(/(:[^;{}]*?)(#[0-9a-fA-F]{3,6})\b(?![0-9a-fA-F])/g, (match, prefix, hex) => {
    const token = lookup.get(hex.toLowerCase())
    if (!token || /url\(/.test(prefix)) return match
    count++
    return prefix + token
  })
  total += count
  console.log(`${count.toString().padStart(4)}  ${file}`)
  if (write && count) fs.writeFileSync(file, source.slice(0, at) + css)
}
console.log(`${total} colour literals ${write ? 'mapped' : 'would map'}`)
