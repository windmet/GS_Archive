const hash = /^sha256:[a-f0-9]{64}$/

// Only forward, disjoint, finite forks with one shared join are supported.
// RAW extraction supplies the exits; no label/adjacency heuristics here.
export function validatedFiniteForks(input) {
  const flow = input?.reading_control_flow
  if (!flow) return []
  if (flow.version !== 1 || !hash.test(flow.base_compiled_sha256) || !Array.isArray(flow.forks)) throw Error('Invalid branch evidence')
  const steps = input.steps || [], used = new Set(), choices = new Set()
  for (const fork of flow.forks) {
    const choice = steps[fork.choice_index], join = steps[fork.join_index]
    if (!choice || choice.type !== 'choice' || choice.step_id !== fork.choice_step_id || choices.has(fork.choice_index)
      || !join || join.step_id !== fork.join_step_id || fork.join_index <= fork.choice_index
      || !hash.test(fork.raw_sha256) || typeof fork.source_file !== 'string'
      || !Array.isArray(fork.branches) || fork.branches.length !== choice.options?.length) throw Error('Invalid finite fork')
    choices.add(fork.choice_index)
    for (const [i, branch] of fork.branches.entries()) {
      const option = choice.options[i]
      if (branch.option_index !== i || branch.label !== option.label || !branch.step_indices?.length
        || steps[branch.step_indices[0]]?.step_id !== (option.target_step_id ?? option.step_id)) throw Error('Invalid branch entry')
      let previous = fork.choice_index
      for (const index of branch.step_indices) {
        if (!Number.isInteger(index) || index <= previous || index >= fork.join_index || used.has(index)
          || !steps[index] || steps[index].type !== 'call') throw Error('Unsupported branch path')
        used.add(index); previous = index
      }
      if (branch.exit_index !== previous) throw Error('Invalid branch exit')
    }
    for (let i = fork.choice_index + 1; i < fork.join_index; i++) {
      if (!used.has(i)) throw Error('Uncovered branch step')
    }
  }
  return flow.forks
}

export function finiteBranchNextIndex(input, index) {
  for (const fork of validatedFiniteForks(input)) {
    if (fork.branches.some(branch => branch.exit_index === index)) return fork.join_index
  }
  return index + 1
}
