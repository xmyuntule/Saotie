/**
 * Lightweight sensitive-content filter, ported verbatim from
 * server/src/sensitive.js so moderation behavior is identical.
 */
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
