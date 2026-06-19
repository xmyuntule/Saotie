import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSite } from '../context/SiteContext';
import Navbar from './Navbar';
import TabBar from './TabBar';
import AuthModal from './AuthModal';
import BackToTop from './BackToTop';
import WelcomeModal from './WelcomeModal';
import ComposeFab from './ComposeFab';

type TitleLabel = string | ((m: RegExpMatchArray) => string);

const TITLES: [RegExp, TitleLabel][] = [
  [/^\/$/, '首页'],
  [/^\/discover/, '发现话题'],
  [/^\/circles/, '圈子'],
  [/^\/circle\//, '圈子'],
  [/^\/qa\/[^/]+/, '问题详情'],
  [/^\/qa/, '问答 · 悬赏求助'],
  [/^\/flash/, '资讯快报'],
  [/^\/write/, '写文章'],
  [/^\/articles/, '专栏'],
  [/^\/article\//, '文章'],
  [/^\/events/, '社区活动'],
  [/^\/event\//, '活动详情'],
  [/^\/nav/, '网址导航'],
  [/^\/achievements/, '任务中心'],
  [/^\/checkin/, '每日签到'],
  [/^\/lottery/, '幸运抽奖'],
  [/^\/leaderboard/, '排行榜'],
  [/^\/changelog/, '更新日志'],
  [/^\/forum\/[^/]+/, '板块'],
  [/^\/forum/, '社区论坛'],
  [/^\/thread\//, '帖子详情'],
  [/^\/post\//, '动态详情'],
  [/^\/u\/([^/]+)/, (m) => `@${decodeURIComponent(m[1])}`],
  [/^\/topic\/([^/]+)/, (m) => `#${decodeURIComponent(m[1])}#`],
  [/^\/messages/, '私信'],
  [/^\/notifications/, '通知'],
  [/^\/member/, '会员中心'],
  [/^\/mall/, '积分商城'],
  [/^\/bookmarks/, '我的收藏'],
  [/^\/history/, '浏览足迹'],
  [/^\/admin/, '管理后台'],
  [/^\/search/, '搜索'],
  [/^\/settings/, '编辑资料'],
];

function titleFor(path: string): string | null {
  for (const [re, label] of TITLES) {
    const m = path.match(re);
    if (m) return typeof label === 'function' ? label(m) : label;
  }
  return null;
}

export default function Layout() {
  const loc = useLocation();
  const reduce = useReducedMotion();
  const site = useSite();
  useEffect(() => {
    window.scrollTo(0, 0);
    const t = titleFor(loc.pathname);
    document.title = t ? `${t} · ${site.name}` : `${site.name} · ${site.slogan}`;
  }, [loc.pathname, site.name, site.slogan]);
  // Enter-only page transition: each route fades + rises in. Keyed by the route
  // group (not query/hash) so list↔detail animates but in-page filter changes don't.
  const routeKey = loc.pathname;
  return (
    <>
      <Navbar />
      <motion.div
        key={routeKey}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <Outlet />
      </motion.div>
      <TabBar />
      <AuthModal />
      <BackToTop />
      <WelcomeModal />
      <ComposeFab />
    </>
  );
}
