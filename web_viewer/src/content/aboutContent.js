// 关于本站 (?view=about) 的全部文字。只改这个文件即可更新页面；页面布局在
// components/archive/ArchiveAbout.vue。段落是纯文本，空行分段；链接的 url 留空时页面显示「待补充」。

export const ABOUT_CONTENT = {
  title: '关于本站',
  lead: 'SideM 资料馆是《アイドルマスター SideM GROWING STARS》的非官方粉丝资料站。',

  sections: [
    {
      id: 'project',
      heading: '这个项目',
      paragraphs: [
        '本站整理游戏中已经公开的剧情、通信、卡片、歌曲、活动与卡池等内容，提供中文译文、剧情阅读与回看，以及谱面、舞台和摄影等小工具。',
        '剧情默认显示中文译文，尚未翻译的段落会自动显示日文原文；随时可以在阅读器或播放器中切换为原文或双语。',
        '资料来自游戏客户端公开的数据，可能存在缺漏或错误；译文由爱好者完成，一切以游戏原文为准。',
      ],
    },
    {
      id: 'owner',
      heading: '站长',
      paragraphs: [
        '【待填写：站长的自我介绍，比如称呼、担当、做这个站的缘由。】',
      ],
    },
    {
      id: 'disclaimer',
      heading: '免责声明',
      paragraphs: [
        '本站为个人运营的非官方粉丝站，与 BANDAI NAMCO Entertainment Inc. 及其他相关权利方没有任何关联，也未获得其授权或认可。',
        '游戏中的文字、图片、音频、视频等素材的著作权及相关权利归原权利方所有，本站仅用于资料整理与爱好者交流，不以营利为目的，不提供游戏资源的下载。',
        '如果权利方认为本站内容有所不妥，请通过下方的联系方式告知，我们会尽快处理。',
        '站内译文为爱好者翻译，仅供参考；转载译文请注明出处。',
      ],
    },
  ],

  // 反馈与联系：mailto 链接最省事，不需要后端。
  contact: {
    heading: '反馈与联系',
    paragraphs: ['发现内容错误、翻译问题或页面故障，欢迎告诉我们。请尽量附上出错的页面链接或截图。'],
    links: [
      { label: '邮箱', url: '', note: '【待填写：例如 mailto:you@example.com】' },
    ],
  },

  // 友链：按分组列出。
  linkGroups: [
    {
      heading: '官方',
      links: [
        { label: 'THE IDOLM@STER 官方网站', url: '', note: '【待填写】' },
        { label: 'SideM GROWING STARS 官方 X（Twitter）', url: '', note: '【待填写】' },
      ],
    },
    {
      heading: '资料与社区',
      links: [
        { label: 'Wiki', url: '', note: '【待填写】' },
      ],
    },
  ],

  thanks: {
    heading: '致谢',
    paragraphs: ['【待填写：例如参与翻译与校对的朋友、提供资料的社区。】'],
  },
}
