import { Router } from 'express';
import { getConfig, moduleStates } from '../helpers.js';

const router = Router();

// 站点外观自定义 (W) + 模块市场 (C) —— 公开只读：品牌 + 全站自定义 CSS + 模块开关。
// 任何访客（含未登录）都能拿到，所以放在 optionalAuth 之后、无需鉴权的公开路由里。
router.get('/', (_req, res) => {
  res.json({
    name: getConfig('site_name', 'HahaSNS') || 'HahaSNS',
    slogan: getConfig('site_slogan', '轻社交社区') || '',
    logo: getConfig('site_logo', '') || '',
    customCss: getConfig('site_custom_css', '') || '',
    modules: moduleStates(),
  });
});

export default router;
