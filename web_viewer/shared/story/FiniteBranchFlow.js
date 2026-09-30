const hash = /^sha256:[a-f0-9]{64}$/

// Forward finite forks support nested alternatives, shared replies and end joins.
// RAW extraction supplies the exits; no label/adjacency heuristics here.
export function validatedFiniteForks(input) {
  const flow = input?.reading_control_flow
  if (!flow) return []
  if (flow.version !== 1 || !hash.test(flow.base_compiled_sha256) || !Array.isArray(flow.forks)) throw Error('Invalid branch evidence')
  const steps = input.steps || [], choices = new Set()
  for (const fork of flow.forks) {
    const choice = steps[fork.choice_index], join = steps[fork.join_index]
    const terminal = fork.join_index === steps.length && fork.join_step_id === null && fork.join_step_type === 'end'
    if (!choice || choice.type !== 'choice' || choice.step_id !== fork.choice_step_id || choices.has(fork.choice_index)
      || (!terminal && (!join || join.step_id !== fork.join_step_id)) || fork.join_index <= fork.choice_index
      || !hash.test(fork.raw_sha256) || typeof fork.source_file !== 'string'
      || !Array.isArray(fork.branches) || fork.branches.length !== choice.options?.length) throw Error('Invalid finite fork')
    choices.add(fork.choice_index)
    const used = new Set()
    for (const [i, branch] of fork.branches.entries()) {
      const option = choice.options[i]
      if (branch.option_index !== i || branch.label !== option.label || !Array.isArray(branch.step_indices)
        || (steps[branch.step_indices[0] ?? fork.join_index]?.step_id ?? (terminal && !branch.step_indices.length ? 0 : null)) !== (option.target_step_id ?? option.step_id)
        || (terminal && !branch.step_indices.length && option.target_kind !== 'end')
        || (!branch.step_indices.length && branch.exit_index !== null)) throw Error('Invalid branch entry')
      if (branch.step_types && (branch.step_types.length !== branch.step_indices.length || branch.step_ids?.length !== branch.step_indices.length || branch.step_indices.some((index,j) => steps[index]?.type !== branch.step_types[j] || steps[index]?.step_id !== branch.step_ids[j]))) throw Error('Branch step identity drift')
      let previous = fork.choice_index
      for (const index of branch.step_indices) {
        if (!Number.isInteger(index) || index <= previous || index >= fork.join_index || used.has(index)
          || !steps[index] || !['call','talk','talk_stamp','adv','choice','stage','fadein','fadeout','slidein','slideout','fadecolor','text_disable','text_time'].includes(steps[index].type)) throw Error('Unsupported branch path')
        used.add(index); previous = index
      }
      if (branch.step_indices.length && branch.exit_index !== previous) throw Error('Invalid branch exit')
    }
    for (let i = fork.choice_index + 1; i < fork.join_index; i++) {
      if (!used.has(i)) throw Error('Uncovered branch step')
    }
  }
  // Nested forks must fit entirely inside one enclosing alternative. Crossing
  // ranges and sibling reuse remain invalid; no branch is flattened at runtime.
  for (const a of flow.forks) for (const b of flow.forks) {
    if (a === b || b.choice_index <= a.choice_index || b.choice_index >= a.join_index) continue
    const owner = a.branches.find(branch => branch.step_indices.includes(b.choice_index))
    if (!owner || b.join_index > a.join_index || b.branches.some(branch => branch.step_indices.some(i => !owner.step_indices.includes(i)))) throw Error('Crossing branch evidence')
  }
  return flow.forks
}

export function finiteBranchNextIndex(input, index) {
  for (const fork of [...validatedFiniteForks(input)].sort((a,b) => a.join_index-a.choice_index-(b.join_index-b.choice_index))) {
    if (fork.branches.some(branch => branch.exit_index === index)) return fork.join_index
  }
  return index + 1
}

export function finiteChoiceTargetIndex(input, choiceIndex, option) {
  const fork = validatedFiniteForks(input).find(f => f.choice_index === choiceIndex)
  const choice = input?.steps?.[choiceIndex]
  const optionIndex = choice?.options?.findIndex(o => o === option || (o.option_id && o.option_id === option.option_id) || (o.label === option.label && (o.source_text ?? o.text) === (option.source_text ?? option.text))) ?? -1
  if (fork && optionIndex >= 0) return fork.branches[optionIndex].step_indices[0] ?? fork.join_index
  return input?.steps?.findIndex(s => s.step_id === Number(option.target_step_id ?? option.step_id)) ?? -1
}
