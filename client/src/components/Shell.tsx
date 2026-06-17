import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import LeftRail from './LeftRail';
import SiteNotice from './SiteNotice';
import { HotTopics, CheckinRank, WhoToFollow, TrendingSearch, FlashWidget, CircleWidget, QAWidget, Footer } from './Widgets';

function DefaultRight() {
  return (
    <>
      <HotTopics />
      <QAWidget />
      <CircleWidget />
      <FlashWidget />
      <WhoToFollow />
      <CheckinRank />
      <TrendingSearch />
      <Footer />
    </>
  );
}

interface ShellProps {
  children?: ReactNode;
  right?: ReactNode | boolean;
  wide?: boolean;
  onCompose?: () => void;
}

// Three-column shell. Pass `right={false}` to hide widgets, or a custom node.
// Pass `wide` for surfaces that need the full width (e.g. the AI chat): the
// content column then spans everything to the right of the nav rail.
export default function Shell({ children, right, wide = false, onCompose }: ShellProps) {
  const nav = useNavigate();
  const compose = onCompose || (() => nav('/', { state: { compose: true } }));
  const noRight = wide || right === false;
  const cls = wide ? 'shell shell-wide' : `shell${noRight ? ' shell-2col' : ''}`;
  return (
    <div className={cls}>
      <LeftRail onCompose={compose} />
      <main className="col-center"><SiteNotice />{children}</main>
      {!noRight && <aside className="col-right">{right || <DefaultRight />}</aside>}
    </div>
  );
}
