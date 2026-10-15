import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Writes src/data/unusedVoiceArchive.json: game voices that no archive page plays. Each family is enumerated
// from the converted voice corpus. Only Saito's unreleased HomeStand lines have script text in RAW; the
// rest are voice-only, so the archive lists the cue and plays the file.
// Usage: node scripts/build-unused-voice-archive.mjs [voiceDir] [rawScenarioDir]
const root = process.cwd()
const voiceDir = process.argv[2] || 'E:/Web_build/SideM_Archived/web_viewer/public/assets/voice'
const rawDir = process.argv[3] || 'E:/BaiduNetdiskDownload/SideM/scripts/scenariodata'
const files = new Set(fs.readdirSync(voiceDir).filter(name => name.endsWith('.m4a')).map(name => name.slice(0, -4)))
const idols = JSON.parse(fs.readFileSync(path.join(root, 'public/data/masterdata/idol_unit_dictionary.json'), 'utf8')).idols
const codes = new Map([...idols.map(idol => [String(idol.idol_id).padStart(3, '0'), idol.idol_code]), ['101', '101ken'], ['102', '102sha']])

// Saito's HomeStand script: one text command per numbered voice; voices 15-20 have no text.
const saitoText = new Map()
for (const command of JSON.parse(fs.readFileSync(path.join(rawDir, '3_x_102sha/scenario_3_1_102.json'), 'utf8')).Command)
  if (command.Type === 'text') saitoText.set(command.Values[3], command.Values[1])
assert.equal(saitoText.size, 15)

const FAMILIES = [
  { id: '9_1', label: '9_1 系列', pattern: /^9_1_(\d{3})_00$/, perSpeaker: 1,
    note: '每人 1 条，平均约 3.7 秒。客户端 IdolController 会读取 9_1_ 前缀的语音包，也有对应的口型数据，但没有脚本、文字或主数据行，具体在什么场景播放尚未确认。' },
  { id: '9_9', label: '9_9 系列（编号末尾 99）', pattern: /^9_9_(\d{3})_00$/, perSpeaker: 1,
    note: '每人 1 条，平均约 0.8 秒，有对应的口型数据，没有脚本、文字或主数据行，用途未确认。' },
  { id: '2_5', label: 'Live 应援（appeal）', pattern: /^2_5_(\d{3})_00_04_0[1-7]$/, perSpeaker: { default: 7, '102sha': 2 },
    note: '原资源整理者归为 appeal。49 位偶像各 7 条，齋藤只有 01 和 07 两条，都没有文字。客户端代码里只直接写了齋藤的 2_5_102_00。' },
  { id: '3_2', label: 'Live 结算（live_result）', pattern: /^3_2_(\d{3})_0[0-3]$/, perSpeaker: 4,
    note: '每人 4 条。主数据有 343 行指向 3_2_NNN 脚本，但脚本里只有播放语音的指令，没有文字。' },
  { id: '3_3', label: '欢呼（cheers）', pattern: /^3_3_(\d{3})_04$/, perSpeaker: 1,
    note: '每人 1 条，平均约 0.5 秒，没有文字。' },
  { id: '3_4', label: '3_4 系列（未分类）', pattern: /^3_4_(\d{3})_0[1-5]$/, perSpeaker: 5,
    note: '原资源整理者未分类。每人 5 条，平均约 1 秒。脚本里只有演出指令，没有文字。' },
  { id: '3_5', label: '山村 3_5', pattern: /^3_5_(\d{3})_00$/, perSpeaker: 1,
    note: '山村贤的 1 条语音，没有脚本或文字。' },
  { id: '3_1_102', label: '齋藤 首页语音（未上线）', pattern: /^3_1_(102)_\d{2}$/, perSpeaker: 21, textKey: cue => cue.slice(-2),
    note: '共 21 条，其中 00–14 的 15 条在原始脚本里有文字，15–20 没有。主数据里没有对应行，游戏里也没有用到，判断为未上线内容。' },
]

const families = FAMILIES.map(({ pattern, perSpeaker, textKey, ...family }) => {
  const bySpeaker = new Map()
  for (const cue of [...files].filter(name => pattern.test(name)).sort()) {
    const code = codes.get(pattern.exec(cue)[1])
    assert.ok(code, `Unknown speaker in ${cue}`)
    const text = textKey && saitoText.get(textKey(cue))
    bySpeaker.set(code, [...(bySpeaker.get(code) || []), text ? { cue, text } : { cue }])
  }
  for (const [code, cues] of bySpeaker) assert.equal(cues.length, perSpeaker[code] ?? perSpeaker.default ?? perSpeaker, `${family.id} ${code}`)
  return { ...family, count: [...bySpeaker.values()].flat().length, speakers: [...bySpeaker].map(([code, cues]) => ({ code, cues })) }
})
assert.deepEqual(families.map(family => family.count), [51, 51, 345, 200, 49, 245, 1, 21])

const target = path.join(root, 'src/data/unusedVoiceArchive.json')
fs.writeFileSync(target, JSON.stringify({ schema: 'GS-UNUSED-VOICE-ARCHIVE-V1', families }, null, 1) + '\n')
console.log(JSON.stringify(Object.fromEntries(families.map(family => [family.id, family.count]))))
