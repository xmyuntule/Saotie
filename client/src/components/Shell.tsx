import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import LeftRail from './LeftRail';
import SiteNotice from './SiteNotice';
import { useSite, moduleOn } from '../context/SiteContext';
import { HotTopics, CheckinRank, WhoToFollow, TrendingSearch, FlashWidget, CircleWidget, QAWidget, Footer } from './Widgets';

// 右栏小组件随模块开关隐藏（与导航/路由一致，闭环 C 模块市场）；通用组件(关注/热搜/页脚)始终显示。
function DefaultRight() {
  const { modules } = useSite();
  return (
    <>
      {moduleOn(modules, 'discover') && <HotTopics />}
      {moduleOn(modules, 'qa') && <QAWidget />}
      {moduleOn(modules, 'circles') && <CircleWidget />}
      {moduleOn(modules, 'flash') && <FlashWidget />}
      <WhoToFollow />
      {moduleOn(modules, 'checkin') && <CheckinRank />}
      <TrendingSearch />
      <Footer />
    </>
  );
}

interface ShellProps {
  children?: ReactNode;
  right?: ReactNode | boolean;
  wide?: boolean;
  narrow?: boolean;
  onCompose?: () => void;
}

// Three-column shell. Pass `right={false}` to hide widgets, or a custom node.
// Pass `wide` for surfaces that need the full width (e.g. browse grids / AI chat).
// Pass `narrow` for reading / form pages: no right rail, content capped at a
// comfortable reading width and CENTERED in the area beside the nav rail
// (avoids the left-shifted "narrow content + empty right gap" look).
export default function Shell({ children, right, wide = false, narrow = false, onCompose }: ShellProps) {
  const nav = useNavigate();
  const compose = onCompose || (() => nav('/', { state: { compose: true } }));
  const noRight = wide || narrow || right === false;
  const cls = wide ? 'shell shell-wide' : narrow ? 'shell shell-read' : `shell${noRight ? ' shell-2col' : ''}`;
  return (
    <div className={cls}>
      <LeftRail onCompose={compose} />
      <main className="col-center"><SiteNotice />{children}</main>
      {!noRight && <aside className="col-right">{right || <DefaultRight />}</aside>}
    </div>
  );
}
