// Scroll advances only while the native update range is nonempty (0x6db88c).
// Reconstruct the union of accepted particles' lifetime intervals. This uses
// Web birth/lifetime boundaries; native frame-batched death overshoot remains
// part of the explicit frame-schedule parity boundary.
export function createNoiseClock(capacity) {
  const intervals=[]
  let deaths=[],lastBirth=-Infinity,prefix=0,earliest=0
  return {
    admit(born,life) {
      if(born<lastBirth)throw Error('Noise births must be chronological')
      lastBirth=born
      deaths=deaths.filter(end=>end>born)
      if(deaths.length>=capacity)return false // Native maxParticles rejects new births.
      const end=born+life
      deaths.push(end)
      const last=intervals.at(-1)
      if(last && born<=last.end)last.end=Math.max(last.end,end)
      else intervals.push({start:born,end})
      return true
    },
    timeAt(time) {
      if(time<earliest-1e-10)throw Error('Noise clock queried before retained history')
      let elapsed=prefix
      for(const span of intervals) {
        if(time<=span.start)break
        elapsed+=Math.min(time,span.end)-span.start
        if(time<span.end)break
      }
      return elapsed
    },
    discardBefore(time) {
      if(time<earliest)throw Error('Noise clock pruning cannot rewind')
      while(intervals.length && intervals[0].end<=time){const span=intervals.shift();prefix+=span.end-span.start}
      earliest=time
    },
  }
}
