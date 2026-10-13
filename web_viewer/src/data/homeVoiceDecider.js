// Native home stand selection (SystemScenarioDecider, HomeStand type, recent capacity 4).
// The pool is the current card's rows plus the idol's general rows: a card row with Param2 set
// waits for awakening, and a card row's override removes that idol row. Each tap keeps the rows
// in term, drops the recent ones while enough remain, and draws by Param1 weight.

export const HOME_VOICE_RECENT_CAPACITY = 4
// ServerDateTime is the game server's clock; the archive reads it as Japan time.
export const HOME_VOICE_TIME_ZONE = 'Asia/Tokyo'

const seconds = value => {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || ''))
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0) : 0
}

/** Wall-clock month and seconds of day for `date` in the server time zone. */
export function homeVoiceClock(date = new Date(), timeZone = HOME_VOICE_TIME_ZONE) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23',
    month: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    .formatToParts(date).map(part => [part.type, Number(part.value)]))
  return { month: parts.month, second: parts.hour * 3600 + parts.minute * 60 + parts.second }
}

/** ValidateNowMonth: twelve months counted from OpenMonth; CloseMonth must not precede now. */
export function homeVoiceMonthOpen(condition, month) {
  const months = Array.from({ length: 12 }, (_, offset) => {
    const value = Number(condition.openMonth || 0) + offset
    return value < 13 ? value : value - 12
  })
  const close = months.indexOf(Number(condition.closeMonth || 0)), now = months.indexOf(month)
  return close >= 0 && now >= 0 && now <= close
}

/** IsInTerm: [open, close) on today's date; a close at or before the open moves to tomorrow. */
export function homeVoiceInTerm(condition, clock) {
  if (!homeVoiceMonthOpen(condition, clock.month)) return false
  const open = seconds(condition.openTime)
  let close = seconds(condition.closeTime)
  if (open >= close) close += 86400
  return open <= clock.second && clock.second < close
}

/** HasPossibility for HomeStand rows, plus the decider's card filters. */
export function homeVoicePool(idolCues, cardCues, { awakened = true } = {}) {
  const cards = cardCues.filter(cue => cue.condition?.weight > 0 && (awakened || !cue.condition.awakenedOnly))
  const overridden = new Set(cards.map(cue => cue.condition.overrideId).filter(Boolean))
  return [...cards, ...idolCues.filter(cue => cue.condition?.weight > 0 && !overridden.has(cue.condition.id))]
}

// DecideByWeight split in two: the home prepares the next voice ahead of the tap, so a draw is
// only remembered once that voice is actually played.
export function createHomeVoiceDecider({ random = Math.random, capacity = HOME_VOICE_RECENT_CAPACITY } = {}) {
  const recent = []
  const decider = {
    recent,
    pick(pool, clock) {
      let candidates = pool.filter(cue => homeVoiceInTerm(cue.condition, clock))
      if (!candidates.length) return null
      if (recent.length < candidates.length) candidates = candidates.filter(cue => !recent.includes(cue.id))
      const total = candidates.reduce((sum, cue) => sum + cue.condition.weight, 0)
      const target = random() * total
      let sum = 0
      return candidates.find(cue => (sum += cue.condition.weight) >= target) || candidates[0]
    },
    commit(cue) {
      if (!cue) return
      recent.push(cue.id)
      while (recent.length > capacity) recent.shift()
    },
    decide(pool, clock) {
      const chosen = decider.pick(pool, clock)
      decider.commit(chosen)
      return chosen
    },
    reset() { recent.length = 0 },
  }
  return decider
}

/** A short Chinese label for the directory: season and time windows as authored. */
export function homeVoiceConditionLabel(condition) {
  if (!condition) return ''
  const parts = []
  if (!(condition.openMonth === 1 && condition.closeMonth === 12)) {
    parts.push(condition.openMonth === condition.closeMonth ? `${condition.openMonth}月` : `${condition.openMonth}–${condition.closeMonth}月`)
  }
  const open = String(condition.openTime || '00:00:00').slice(0, 5), close = String(condition.closeTime || '00:00:00').slice(0, 5)
  if (!(open === '00:00' && close === '00:00')) parts.push(`${open}–${close}`)
  if (condition.awakenedOnly) parts.push('觉醒后')
  return parts.join(' · ')
}

/** The directory's general-pool grouping by authored condition. */
export function homeVoiceConditionKind(condition) {
  const seasonal = condition && !(condition.openMonth === 1 && condition.closeMonth === 12)
  const timed = condition && !(condition.openTime === '00:00:00' && condition.closeTime === '00:00:00')
  return seasonal ? 'season' : timed ? 'time' : 'always'
}
