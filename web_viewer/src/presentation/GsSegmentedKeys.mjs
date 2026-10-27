// Arrow-key movement for a mode switch (radiogroup): wraps, skips disabled options, and
// returns -1 when nothing can be selected so the caller leaves the selection alone.
export function segmentedNextIndex(options, current, key) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[key]
  const count = options.length
  if (count === 0) return -1
  const enabled = index => !options[index].disabled
  if (key === 'Home') return options.findIndex((_, index) => enabled(index))
  if (key === 'End') { for (let index = count - 1; index >= 0; index--) if (enabled(index)) return index; return -1 }
  if (!step) return -1
  for (let hop = 1; hop <= count; hop++) {
    const index = (((current + step * hop) % count) + count) % count
    if (enabled(index)) return index
  }
  return -1
}
