// Page state belongs to the current idol visit; the repository retains shared index data.
export function createIdolCommunicationReadiness({ ensure, hasData, publish }) {
  let revision = 0
  let currentId = ''

  function leave() {
    revision += 1
    currentId = ''
    publish({ status: 'idle', idolCode: '' })
  }

  async function enter(idolCode) {
    if (!idolCode) return leave()
    currentId = idolCode
    const requestRevision = ++revision
    if (hasData()) {
      publish({ status: 'ready', idolCode })
      return
    }
    publish({ status: 'loading', idolCode })
    const data = await ensure()
    if (requestRevision !== revision || currentId !== idolCode) return
    publish({ status: data && hasData() ? 'ready' : 'error', idolCode })
  }

  return { enter, leave }
}
