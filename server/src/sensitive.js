// Lightweight sensitive-content filter for user-generated text.
// Demo-grade word list across common moderation categories. Evasion-resistant
// via normalization (lowercase, strip spaces/punct between chars).
const BANNED = [
  // 辱骂 / abuse
  '傻逼', '煞笔', '沙雕逼', '操你', '草你妈', '日你妈', '滚你妈', '妈的逼', 'nmsl', 'smdb', '去死吧', '贱人', '婊子', '王八蛋',
  // 色情 / porn
  '约炮', '一夜情', '裸聊', '黄片', 'av女优', '成人电影', '嫖娼', '卖淫', '色情服务', '性服务', '做爱视频', '情色',
  // 赌博 / gambling
  '赌博网', '网上赌场', '百家乐', '澳门赌场', '六合彩', '时时彩', '私彩',
  // 毒品 / drugs
  '冰毒', '大麻', '摇头丸', '海洛因', '吸毒', '贩毒',
  // 诈骗 / 广告 / scam & spam
  '刷单兼职', '日赚过万', '私聊有偿', '代开发票', '办证刻章', '高炮贷款', '彩票内幕', '稳赚不赔', '加微信领',
  // 政治敏感(泛化占位)
  '反动言论', '颠覆国家', '法轮',
];

const NORMALIZE = (s) => (s || '').toLowerCase().replace(/[\s　\-_.*~·]/g, '');

const NORM_BANNED = BANNED.map((w) => ({ raw: w, norm: NORMALIZE(w) }));

// Returns the first matched banned word, or null if clean.
export function checkSensitive(text) {
  if (!text) return null;
  const t = NORMALIZE(text);
  for (const { raw, norm } of NORM_BANNED) {
    if (norm && t.includes(norm)) return raw;
  }
  return null;
}

// Throws a 400-style guard if text contains sensitive content (used in routes).
export function assertClean(...texts) {
  for (const t of texts) {
    const bad = checkSensitive(t);
    if (bad) { const e = new Error('内容包含敏感信息，请修改后重试'); e.status = 400; throw e; }
  }
}

export default { checkSensitive, assertClean };
