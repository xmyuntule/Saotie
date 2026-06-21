// VIP 多等级定义 —— 前后端共识的单一来源（价格为「分」/月）。level 0 = 非会员。
export interface VipTier {
  level: number;
  name: string;   // 全称
  short: string;  // 徽章短名 VIP1/2/3
  price: number;  // 每月价格（分）
  color: string;  // 主题色（徽章底/卡片描边）
  ink: string;    // 徽章文字色（与 color 对比）
  tagline: string;
  perks: string[];
}

export const VIP_TIERS: VipTier[] = [
  { level: 1, name: '青铜会员', short: 'VIP1', price: 1200, color: '#b06a3b', ink: '#fff', tagline: '入门尊享，畅快互动',
    perks: ['专属 VIP1 标识', '私信不受每日条数限制', '签到 / 互动积分 +20%', '发布动态可置顶 1 条'] },
  { level: 2, name: '黄金会员', short: 'VIP2', price: 3600, color: '#e0a020', ink: '#5e3d00', tagline: '高频活跃用户之选',
    perks: ['含青铜会员全部权益', '专属 VIP2 金色标识', '签到 / 互动积分 +50%', '主页个性封面与装扮', '动态置顶 3 条'] },
  { level: 3, name: '黑钻会员', short: 'VIP3', price: 9800, color: '#7c4dff', ink: '#fff', tagline: '至尊体验，全部解锁',
    perks: ['含黄金会员全部权益', '专属 VIP3 黑钻标识', '签到 / 互动积分翻倍', '主页专属皮肤', '发帖优先展示 · 免审核', '专属客服与新功能内测'] },
];

export function vipTier(level?: number | null): VipTier | null {
  if (!level) return null;
  return VIP_TIERS.find((t) => t.level === level) || null;
}
