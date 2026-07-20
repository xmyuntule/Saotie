/**
 * Lightweight sensitive-content filter, ported verbatim from
 * server/src/sensitive.js so moderation behavior is identical.
 */
const BANNED = [
  // 辱骂 / abuse
  '傻逼', '煞笔', '沙雕逼', '操你', '草你妈', '日你妈', '滚你妈', '妈的逼', 'nmsl', 'smdb', '去死吧', '贱人', '婊子', '王八蛋',
  // 色情 / porn
  '约炮', '一夜情', '裸聊', '黄片', 'av女优', '成人电影', '嫖娼', '卖淫', '色情服务', '性服务', '做爱视频', '情色',
  '外围女', '上门服务', '楼凤', '援交', '色情网', '裸照交易', '成人视频', '未成年陪聊',
  // 赌博 / gambling
  '赌博网', '网上赌场', '百家乐', '澳门赌场', '六合彩', '时时彩', '私彩', '博彩平台', '体育投注', '赌球', '网赌', '洗码', '网投',
  // 毒品 / drugs
  '冰毒', '大麻', '摇头丸', '海洛因', '吸毒', '贩毒', '制毒', '贩卖毒品', '笑气', 'k粉', '麻古',
  // 诈骗 / 广告 / scam & spam
  '刷单兼职', '日赚过万', '私聊有偿', '代开发票', '办证刻章', '高炮贷款', '彩票内幕', '稳赚不赔', '加微信领',
  '资金盘', '杀猪盘', '跑分平台', '洗钱通道', '银行卡四件套', '信用卡套现', '非法集资', '虚拟币拉盘', '精准引流',
  // 政治安全 / national & political safety
  '反动言论', '颠覆国家', '颠覆政权', '煽动颠覆', '推翻国家政权', '推翻政府', '分裂国家', '民族分裂',
  '台独', '港独', '藏独', '疆独', '东突', '反华势力', '辱华', '颜色革命', '非法集会', '非法游行',
  // 邪教 / cult
  '法轮', '法轮功', '全能神', '门徒会', '呼喊派', '邪教组织',
  // 暴恐极端 / terrorism & weapons
  '恐怖袭击', '恐怖组织', '极端主义', '人肉炸弹', '炸弹制作', '自制炸药', '爆炸物制作', '枪支买卖', '买枪', '卖枪',
  '管制刀具批发', '砍人直播',
];

const NORMALIZE = (s: string | null | undefined) =>
  (s || '').toLowerCase().replace(/[\s　\-_.*~·]/g, '');

const NORM_BANNED = BANNED.map((w) => ({ raw: w, norm: NORMALIZE(w) }));

// ===== 站长后台可配置部分（site_config: sensitive_enabled + sensitive_words）=====
// checkSensitive 被 14+ service 同步调用，无法逐处改 async；改由 SensitiveService
// 定期(及 admin 写入后)从 DB 刷新到下面这份进程内缓存，保持调用方零改动。
let _enabled = true; // sensitive_enabled，默认开
let _customRaw: string | null = null;
let _customNorm: { raw: string; norm: string }[] = [];

/** 由 SensitiveService 调用，把 site_config 的值刷进进程内缓存。Mirrors server/src/sensitive.js. */
export function setSensitiveConfig(
  enabledRaw: string | null | undefined,
  wordsRaw: string | null | undefined,
): void {
  // Express: getConfig('sensitive_enabled','1') !== '1' → 关；即仅 '1' 为开，默认 '1'
  _enabled = (enabledRaw ?? '1') === '1';
  const raw = wordsRaw || '';
  if (raw !== _customRaw) {
    _customRaw = raw;
    _customNorm = raw
      .split(/[\n,，、;；\s]+/)
      .map((w) => w.trim())
      .filter(Boolean)
      .map((w) => ({ raw: w, norm: NORMALIZE(w) }))
      .filter((x) => x.norm);
  }
}

/** Returns the first matched banned word, or null if clean. 后台总开关可关闭。 */
export function checkSensitive(text: string | null | undefined): string | null {
  if (!text) return null;
  if (!_enabled) return null; // 后台关闭敏感词过滤
  const t = NORMALIZE(text);
  for (const { raw, norm } of NORM_BANNED) {
    if (norm && t.includes(norm)) return raw;
  }
  for (const { raw, norm } of _customNorm) {
    if (t.includes(norm)) return raw; // 站长自定义词
  }
  return null;
}
