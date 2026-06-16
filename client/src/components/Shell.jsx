import { useNavigate } from 'react-router-dom';
import LeftRail from './LeftRail';
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

// Three-column shell. Pass `right={false}` to hide widgets, or custom node.
export default function Shell({ children, right, onCompose }) {
  const nav = useNavigate();
  const compose = onCompose || (() => nav('/', { state: { compose: true } }));
  const noRight = right === false;
  return (
    <div className={`shell${noRight ? ' shell-2col' : ''}`}>
      <LeftRail onCompose={compose} />
      <main className="col-center">{children}</main>
      {!noRight && <aside className="col-right">{right || <DefaultRight />}</aside>}
    </div>
  );
}
