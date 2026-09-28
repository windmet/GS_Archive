// Validate every local RAW text candidate against the authoritative schema.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const audit = path.join(root, '.analysis/local-story-strict-v2-r2')
const ledger = JSON.parse(await readFile(path.join(audit, 'ledger.json'), 'utf8'))
const schema = JSON.parse(await readFile(path.join(root, 'schemas/compiled-scenario-v2-authoritative.schema.json'), 'utf8'))
const ajv = new Ajv2020({ strict: true, allErrors: true })
addFormats(ajv)
const validate = ajv.compile(schema)
let checked = 0
const failures = []
for (const entry of ledger.entries) {
  if (!['strict-v2-candidate', 'schema-invalid-choice-target'].includes(entry.status)) continue
  const candidate = JSON.parse(await readFile(path.join(audit, 'candidates', entry.candidate), 'utf8'))
  checked++
  const valid = validate(candidate)
  if ((entry.status === 'strict-v2-candidate' && !valid)
    || (entry.status === 'schema-invalid-choice-target' && (valid || !validate.errors?.every(error =>
      error.keyword === 'minimum' && error.instancePath.includes('/options/'))))) {
    failures.push({ candidate: entry.candidate, status: entry.status, errors: validate.errors })
  }
}
const byReason = {}
for (const failure of failures) {
  for (const error of failure.errors || []) {
    const key = `${error.keyword}:${error.instancePath.replace(/\/steps\/\d+/gu, '/steps/*').replace(/\/options\/\d+/gu, '/options/*')}:${error.params?.additionalProperty || ''}`
    byReason[key] = (byReason[key] || 0) + 1
  }
}
await writeFile(path.join(audit, 'schema-validation.json'), `${JSON.stringify({ checked, failures, byReason }, null, 2)}\n`)
console.log(JSON.stringify({ checked, unexpected_failures: failures.length,
  expected_invalid_choice_targets: ledger.entries.filter(entry => entry.status === 'schema-invalid-choice-target').length,
  byReason }, null, 2))
if (failures.length) process.exitCode = 1
