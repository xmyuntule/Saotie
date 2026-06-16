// Relative time in Chinese
export function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z')).getTime();
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return '刚刚';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}天前`;
  const date = new Date(then);
  const now = new Date();
  if (date.getFullYear() === now.getFullYear())
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function clockTime(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z'));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 1234 -> 1.2k, 12345 -> 1.2w
export function fmtNum(n) {
  n = Number(n) || 0;
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
}

// Parse text into rich segments: #topic#, @mention, plain
export function parseRich(text = '') {
  const parts = [];
  const re = /(#[^#\n]{1,30}#)|(@[一-龥A-Za-z0-9_]{1,20})/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ t: 'text', v: text.slice(last, m.index) });
    if (m[1]) parts.push({ t: 'topic', v: m[1].slice(1, -1) });
    else if (m[2]) parts.push({ t: 'mention', v: m[2].slice(1) });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ t: 'text', v: text.slice(last) });
  return parts;
}

export const VIS_LABELS = {
  public: { label: '公开', icon: '🌐' },
  private: { label: '私密', icon: '🔒' },
  password: { label: '密码', icon: '🔑' },
  paid: { label: '付费', icon: '💎' },
  anonymous: { label: '匿名', icon: '🕶️' },
};

export const GENDER = { male: '♂', female: '♀', secret: '' };
