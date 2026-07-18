import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import LeftRail from './LeftRail';
import { DefaultRightSidebar, type SidebarBlock } from './RightSidebar';

interface ShellProps {
  children?: ReactNode;
  right?: ReactNode | boolean;
  rightBlocks?: SidebarBlock[];
  rightDefaultBlocks?: string[];
  wide?: boolean;
  narrow?: boolean;
  // 后台可配置布局：'default' | 'wide' | 'narrow'（优先于 wide/narrow 布尔；来自 useLayout()）
  layout?: string;
  pageKey?: string;
  onCompose?: () => void;
}

function inferPageKey(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return 'home';
  if (parts[0] === 'forum' && parts[1]) return 'board';
  if (parts[0] === 'u' && parts[1]) return 'profile';
  return parts[0];
}

// Three-column shell. Pass `right={false}` to hide widgets, or a custom node.
// Pass `wide` for surfaces that need the full width (e.g. browse grids / AI chat).
// Pass `narrow` for reading / form pages: no right rail, content capped at a
// comfortable reading width while keeping the same left gap as normal pages.
export default function Shell({
  children,
  right,
  rightBlocks,
  rightDefaultBlocks,
  wide = false,
  narrow = false,
  layout,
  pageKey,
  onCompose,
}: ShellProps) {
  const nav = useNavigate();
  const loc = useLocation();
  const compose = onCompose || (() => nav('/', { state: { compose: true } }));
  // layout prop（后台配置）优先；否则回落到 wide/narrow 布尔
  const mode = layout === 'wide' || layout === 'narrow' || layout === 'default'
    ? layout
    : (wide ? 'wide' : narrow ? 'narrow' : 'default');
  const noRight = mode === 'wide' || mode === 'narrow' || right === false;
  const cls = mode === 'wide' ? 'shell shell-wide' : mode === 'narrow' ? 'shell shell-read' : `shell${noRight ? ' shell-2col' : ''}`;
  const page = pageKey || inferPageKey(loc.pathname);
  const customBlocks = Object.fromEntries((rightBlocks || []).map((block) => [block.key, block]));
  const fallbackBlocks = rightDefaultBlocks || rightBlocks?.map((block) => String(block.key));
  const hasConfigurableRight = !!rightBlocks?.length || !!rightDefaultBlocks?.length;
  return (
    <div className={cls}>
      <LeftRail onCompose={compose} />
      <main className="col-center">{children}</main>
      {!noRight && (
        <aside className="col-right">
          {hasConfigurableRight
            ? <DefaultRightSidebar pageKey={page} customBlocks={customBlocks} fallbackBlocks={fallbackBlocks} />
            : right || <DefaultRightSidebar pageKey={page} />}
        </aside>
      )}
    </div>
  );
}
