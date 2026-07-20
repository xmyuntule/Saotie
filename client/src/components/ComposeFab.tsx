import { useLocation } from 'react-router-dom';
import Icon from './Icon';
import { useCompose } from '../context/ComposeContext';
import { useAuth } from '../context/AuthContext';

// 仅在「动态流」类页面显示的发布悬浮按钮（工具页如商城/抽奖/会员/问答不再被它遮挡内容）。
const FEED_PREFIXES = ['/discover', '/forum', '/circles', '/circle', '/bookmarks', '/u/'];

export default function ComposeFab() {
  const { openCompose } = useCompose();
  const { user, setAuthOpen } = useAuth();
  const { pathname } = useLocation();
  const onFeed = pathname === '/' || FEED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!onFeed) return null;
  return (
    <button className="compose-fab" onClick={() => (user ? openCompose() : setAuthOpen(true))} aria-label="发布动态">
      <Icon name="edit" size={24} />
    </button>
  );
}
