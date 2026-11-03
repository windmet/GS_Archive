// 关于本站 (?view=about) 的全部文字。只改这个文件即可更新页面；页面布局在
// components/archive/ArchiveAbout.vue。段落是纯文本，空行分段。以【待填写开头的段落和 url 留空的链接只在维护者模式（?maintainer=1）
// 显示（链接显示「待补充」）；读者看不到，整节都没内容时整节隐藏。

// 首屏、资料馆幕布和本页页头共用的一句站点说明与游戏服务期。index.html 的首屏没有脚本，里面是同一句的静态副本，改这里时一起改。
export const SITE_LINE = '《偶像大师 SideM GROWING STARS》非官方资料馆'
export const SERVICE_PERIOD = Object.freeze({ start: '2021.10.06', end: '2023.07.31' })

export const ABOUT_CONTENT = {
  title: '关于本站',

  // 站长：头像外圈是担当的身份色；推し写偶像编号，名字和颜色取自偶像字典。
  owner: {
    heading: '站长',
    name: '风期',
    handle: 'windmet',
    ringIdol: '040ren',
    intro: '新人 P',
    oshi: [
      { label: '担当', idols: ['040ren'] },
      { label: '箱推', note: 'THE 虎牙道', idols: ['038tak', '039mcr', '040ren'] },
      { label: '好感', idols: ['045sor', '031sak', '024shk'] },
    ],
    paragraphs: [
      '社交苦手，更喜欢在评论区和大家交流。',
      '发现 bug 可以直接在 GitHub Issues 或视频评论区提出，我会尽快修复！',
      '建站不易，欢迎来 GitHub 给项目点个 ⭐。',
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/windmet/GS_Archive', icon: 'github' },
      { label: '提交问题', url: 'https://github.com/windmet/GS_Archive/issues', icon: 'issue' },
      { label: 'windmet@outlook.com', url: 'mailto:windmet@outlook.com', icon: 'mail' },
      { label: '视频主页', url: '', icon: 'video', note: '【待填写：视频评论区所在的主页链接】' },
    ],
    group: { label: 'QQ 群', name: 'GS-Archive 测试群', number: '1130533021' },
  },

  // 传送门：每条写清楚去那里能看到什么；域名由页面从 url 取。
  linkGroups: [
    {
      heading: '本站',
      links: [
        { label: 'GitHub 仓库', url: 'https://github.com/windmet/GS_Archive', description: '源代码与更新记录，点个 ⭐ 支持一下' },
        { label: '问题反馈', url: 'https://github.com/windmet/GS_Archive/issues', description: '报告错误、翻译问题或页面故障' },
        { label: '开发文档', url: '', description: '建站与资料整理的笔记', note: '【待填写】' },
      ],
    },
    {
      heading: '官方',
      links: [
        { label: 'アイドルマスター SideM 公式', url: 'https://idolmaster-official.jp/sidem', description: '品牌页；「サイスタ アーカイブ」栏目是官方的剧情视频存档' },
        { label: 'ASOBISTORY', url: 'https://asobistory.asobistore.jp/', description: 'SideM 的新剧情在这里连载（315 Production Episode 等）' },
      ],
    },
    {
      heading: '资料与社区',
      links: [
        { label: '参考站点', url: '', description: '', note: '【待填写】' },
      ],
    },
  ],

  sections: [
    {
      id: 'project',
      heading: '这个项目',
      paragraphs: [
        '本站整理游戏中已经公开的剧情、通信、卡片、歌曲、活动与卡池等内容，提供中文译文、剧情阅读与回看，以及谱面、2D舞台和摄影工作台。',
        '剧情默认显示中文译文，尚未翻译的段落会自动显示日文原文；随时可以在阅读器或播放器中切换为原文或双语。',
        '资料来自游戏客户端公开的数据，可能存在缺漏或错误；译文由爱好者完成，一切以游戏原文为准。',
      ],
    },
    {
      id: 'disclaimer',
      heading: '免责声明',
      paragraphs: [
        '本站为个人运营的非官方粉丝站，与 BANDAI NAMCO Entertainment Inc. 及其他相关权利方没有任何关联，也未获得其授权或认可。',
        '游戏中的文字、图片、音频、视频等素材的著作权及相关权利归原权利方所有，本站仅用于资料整理与爱好者交流，不以营利为目的，不提供游戏资源的下载。',
        '如果权利方认为本站内容有所不妥，请发邮件至 windmet@outlook.com 告知，我会尽快处理。',
        '站内译文为爱好者翻译，仅供参考；转载译文请注明出处。',
      ],
    },
  ],

  thanks: {
    heading: '致谢',
    paragraphs: [
      '柚子贝汁 P（担当 円城寺道流）：从最初就一直陪着我，测试每一个版本，也提了很多产品上的建议。',
      'shiogi P（担当 大河タケル、都築圭）：六月末七月初项目刚起步时，她给了关键的帮助。',
      '参加 10 月内测的各位制作人：你们找到的问题，很多是我自己排查不出来的。',
      'Wiki 的维护者们：本站的卡池信息来自 Wiki 的记录。',
    ],
  },
}
