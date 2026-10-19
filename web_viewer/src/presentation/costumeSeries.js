// Story costumes the client leaves unnamed get a site label from their textures (checked 2026-10-15).
// Series numbers are per idol, so only 003/004 follow a rule: all 34 *_004_* are sportswear (tracksuits,
// jerseys, tanks, shorts) and all 25 *_003_* are autumn/winter casual (knits, coats, scarves).
// Every other unnamed model is labelled one by one; *_005_01 and 010pie_002_01 repeat their named base
// costume's textures (005_01 adds a rosette badge), so they reuse its name. Labels follow the spine model:
// the client's image_costume_icon_037jir_108_00 shows a yellow jacket, but the model is a grey sweater.
export const UNNAMED_COSTUME_SERIES = Object.freeze({ '003': '秋冬便服', '004': '运动服' })

export const UNNAMED_COSTUME_LABELS = Object.freeze({
  '004ter_006_00': '藏青西装外套',
  '005kao_001_00': '白大褂',
  '007kei_006_00': '条纹开衫便服',
  '009kyj_001_00': '便利店制服',
  '010pie_001_00': '青蛙玩偶装',
  '010pie_002_01': '基础常服',
  '011min_005_01': '茁壮明彩',
  '011min_109_00': '红色皮夹克',
  '012yus_006_00': '浅蓝和风便服',
  '016sei_005_01': '茁壮明彩',
  '016sei_107_00': '围裙工作装',
  '022nat_006_00': '深色针织衫',
  '024shk_002_00': '红色开衫便服',
  '025suz_001_00': '立领学生服',
  '026gen_001_00': '立领学生服',
  '027yuk_001_00': '咖啡店制服',
  '028soi_001_00': '甜点师制服',
  '029ass_001_00': '咖啡店制服',
  '030mak_001_00': '咖啡店制服',
  '031sak_001_00': '女仆装',
  '035mco_001_00': '教师装',
  '035mco_005_01': '茁壮明彩',
  '035mco_108_00': '黑色机车夹克',
  '036rui_001_00': '教师装',
  '037jir_001_00': '教师装',
  '037jir_005_01': '茁壮明彩',
  '037jir_108_00': '灰色毛衣便服',
  '039mcr_001_00': '拉面店 T 恤',
  '041ryo_001_00': '女装偶像服',
  '044ame_005_01': '茁壮明彩',
  '045sor_001_00': '围裙便服',
  '047shu_002_00': '黑色便服',
  '048mom_001_01': '颜料飞溅便服',
})

const MODEL_ID = /^\d{3}[a-z]{3}_(\d{3})_(\d{2})$/

// Site label for an unnamed costume model, or '' when none has been identified.
export function storyCostumeLabel(modelId) {
  if (UNNAMED_COSTUME_LABELS[modelId]) return UNNAMED_COSTUME_LABELS[modelId]
  const match = MODEL_ID.exec(modelId || '')
  const series = match && UNNAMED_COSTUME_SERIES[match[1]]
  if (!series) return ''
  // Jupiter has two different sportswear sets (_004_00 and _004_01).
  return match[2] === '00' ? series : `${series} ${Number(match[2]) + 1}`
}
