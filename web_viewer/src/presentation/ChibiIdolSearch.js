// Search conveniences for the 49 canonical performers in live-chibi/manifest.json.
// Chinese spellings follow public/translations/zh-CN/entities/idols.json; Japanese
// readings follow masterdata/idol_unit_dictionary.json name_fields.kana.
// These aliases are UI search terms, not official names or metadata. Keep them
// separate from display names, costume identities and the stage's performer IDs.
const ALIAS_FORMS = {
  '001tom': ['tianlai dongma', 'tian lai dong ma', 'amagase touma', 'amagase toma'], // 天濑冬马
  '002sht': ['yushouxi xiangtai', 'yu shou xi xiang tai', 'mitarai shouta', 'mitarai shota'], // 御手洗翔太
  '003hok': ['yijiyuan beidou', 'yi ji yuan bei dou', 'ijuin hokuto', 'ijuuin hokuto'], // 伊集院北斗
  '004ter': ['tiandao hui', 'tian dao hui', 'tendou teru', 'tendo teru'], // 天道辉
  '005kao': ['yingting xun', 'ying ting xun', 'sakuraba kaoru'], // 樱庭薰
  '006tsu': ['baimu yi', 'bai mu yi', 'kashiwagi tsubasa'], // 柏木翼
  '007kei': ['duzhu gui', 'du zhu gui', 'tsuzuki kei'], // 都筑圭
  '008rei': ['shenle li', 'shenyue li', 'shen le li', 'shen yue li', 'kagura rei'], // 神乐丽
  '009kyj': ['yingcheng gonger', 'ying cheng gong er', 'takajou kyouji', 'takajo kyoji'], // 鹰城恭二
  '010pie': ['piaier', 'pi ai er', 'pierre', 'pieru', 'pieeru'], // 皮埃尔
  '011min': ['dubian shi', 'du bian shi', 'watanabe minori'], // 渡边实
  '012yus': ['cangjing youjie', 'cang jing you jie', 'aoi yuusuke', 'aoi yusuke'], // 苍井悠介
  '013kys': ['cangjing xiangjie', 'cang jing xiang jie', 'aoi kyousuke', 'aoi kyosuke'], // 苍井享介
  '014hid': ['woye yingxiong', 'wo ye ying xiong', 'akuno hideo'], // 握野英雄
  '015ryu': ['mucun long', 'mu cun long', 'kimura ryuu', 'kimura ryu'], // 木村龙
  '016sei': ['xinxuan chengsi', 'xin xuan cheng si', 'shingen seiji'], // 信玄诚司
  '017kir': ['maoliu tongsheng', 'mao liu tong sheng', 'nekoyanagi kirio'], // 猫柳桐生
  '018shm': ['huacun xiangzhen', 'hua cun xiang zhen', 'hanamura shouma', 'hanamura shoma'], // 华村翔真
  '019kur': ['qingcheng jiulang', 'qing cheng jiu lang', 'kiyosumi kurou', 'kiyosumi kuro'], // 清澄九郎
  '020hay': ['qiushan sunren', 'qiu shan sun ren', 'akiyama hayato'], // 秋山隼人
  '021jun': ['dongmei xun', 'dong mei xun', 'fuyumi jun'], // 冬美旬
  '022nat': ['shen xialai', 'shen xia lai', 'sakaki natsuki'], // 榊夏来
  '023har': ['ruoli chunming', 'ruo li chun ming', 'wakazato haruna'], // 若里春名
  '024shk': ['yilaigu siji', 'yi lai gu si ji', 'iseya shiki'], // 伊濑谷四季
  '025suz': ['hongjing zhuque', 'hong jing zhu que', 'akai suzaku'], // 红井朱雀
  '026gen': ['heiye xuanwu', 'hei ye xuan wu', 'kurono genbu'], // 黑野玄武
  '027yuk': ['shengu xingguang', 'shen gu xing guang', 'kamiya yukihiro'], // 神谷幸广
  '028soi': ['dongyun zhuangyilang', 'dong yun zhuang yi lang', 'shinonome souichirou', 'shinonome soichiro'], // 东云庄一郎
  '029ass': ['asilan biexibu ii shi', 'a si lan bie xi bu ii shi', 'asilan biexibu ershi', 'asuran beruzebyuto nisei', 'aslan beelzebub ii', 'aslan beelzebub 2'], // 阿斯兰·别西卜II世
  '030mak': ['maoyue juanxu', 'mao yue juan xu', 'uzuki makio'], // 卯月卷绪
  '031sak': ['shuidao xiao', 'shui dao xiao', 'mizushima saki'], // 水岛咲
  '032nao': ['gangcun zhiyang', 'gang cun zhi yang', 'okamura nao'], // 冈村直央
  '033shr': ['ju zhilang', 'ju zhi lang', 'tachibana shirou', 'tachibana shiro'], // 橘志狼
  '034kan': ['jiye huayin', 'ji ye hua yin', 'himeno kanon'], // 姬野花音
  '035mco': ['yu daofu', 'yu dao fu', 'hazama michio'], // 硲道夫
  '036rui': ['wutian lei', 'wu tian lei', 'maita rui'], // 舞田类
  '037jir': ['shanxia cilang', 'shan xia ci lang', 'yamashita jirou', 'yamashita jiro'], // 山下次郎
  '038tak': ['dahe wu', 'da he wu', 'taiga takeru'], // 大河武
  '039mcr': ['yuanchengsi daoliu', 'yuan cheng si dao liu', 'enjouji michiru', 'enjoji michiru'], // 圆城寺道流
  '040ren': ['yaqi lian', 'ya qi lian', 'kizaki ren'], // 牙崎涟
  '041ryo': ['qiuyue liang', 'qiu yue liang', 'akizuki ryou', 'akizuki ryo'], // 秋月凉
  '042dai': ['dou dawu', 'dou da wu', 'kabuto daigo'], // 兜大吾
  '043kaz': ['jiushijiu yixi', 'jiu shi jiu yi xi', 'tsukumo kazuki'], // 九十九一希
  '044ame': ['gezhiye yuyan', 'ge zhi ye yu yan', 'kuzunoha amehiko'], // 葛之叶雨彦
  '045sor': ['beicun xiangle', 'beicun xiangyue', 'bei cun xiang le', 'bei cun xiang yue', 'kitamura sora'], // 北村想乐
  '046chr': ['gulun kelisi', 'gu lun ke li si', 'koron kurisu', 'koron chris'], // 古论克里斯
  '047shu': ['tianfeng xiu', 'tian feng xiu', 'amamine shuu', 'amamine shu'], // 天峰秀
  '048mom': ['huayuan baibairen', 'hua yuan bai bai ren', 'hanazono momohito'], // 花园百百人
  '049eis': ['meijian ruixin', 'mei jian rui xin', 'mayumi eishin'], // 眉见锐心
}

// Include both spaced and compact full-name forms; individual name parts remain
// searchable through the spaced form. No arbitrary transliteration is performed.
const SEARCH_ALIASES = Object.freeze(Object.fromEntries(Object.entries(ALIAS_FORMS)
  .map(([idolCode, forms]) => [idolCode, [...new Set(forms.flatMap(form => [form, form.replaceAll(' ', '')]))].join(' ')])))

export function chibiIdolSearchAliases(idolCode) {
  return typeof idolCode === 'string' && Object.hasOwn(SEARCH_ALIASES, idolCode)
    ? SEARCH_ALIASES[idolCode] : ''
}
