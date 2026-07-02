import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * 智能返回（spec 01 §2.3）。
 *
 * 有站内导航历史时后退一步（`nav(-1)`）；直接打开分享链接落地、没有站内历史时，跳到该内容类型的
 * 父列表——避免 `nav(-1)` 把用户退出站外（到来源站点或空白页）。
 * react-router v6：直接落地（非站内跳转进入）的历史条目 `location.key === 'default'`。
 */
export function useSmartBack(fallback: string) {
  const nav = useNavigate();
  const loc = useLocation();
  return useCallback(() => {
    if (loc.key && loc.key !== 'default') nav(-1);
    else nav(fallback);
  }, [nav, loc.key, fallback]);
}
