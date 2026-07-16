import { Fragment, type ReactNode } from 'react';
import { useSite, moduleOn } from '../context/SiteContext';
import {
  CheckinRank,
  CircleWidget,
  FlashWidget,
  Footer,
  HotTopics,
  QAWidget,
  TrendingSearch,
  WhoToFollow,
} from './Widgets';

export type SidebarBlockKey =
  | 'hotTopics'
  | 'qa'
  | 'circles'
  | 'flash'
  | 'whoToFollow'
  | 'checkinRank'
  | 'trendingSearch'
  | 'footer';

type SidebarBlock = {
  key: SidebarBlockKey;
  module?: string;
  render: () => ReactNode;
};

export const DEFAULT_RIGHT_BLOCKS: SidebarBlockKey[] = [
  'hotTopics',
  'qa',
  'circles',
  'flash',
  'whoToFollow',
  'checkinRank',
  'trendingSearch',
  'footer',
];

export const SIDEBAR_BLOCKS: Record<SidebarBlockKey, SidebarBlock> = {
  hotTopics: { key: 'hotTopics', module: 'discover', render: () => <HotTopics /> },
  qa: { key: 'qa', module: 'qa', render: () => <QAWidget /> },
  circles: { key: 'circles', module: 'circles', render: () => <CircleWidget /> },
  flash: { key: 'flash', module: 'flash', render: () => <FlashWidget /> },
  whoToFollow: { key: 'whoToFollow', render: () => <WhoToFollow /> },
  checkinRank: { key: 'checkinRank', module: 'checkin', render: () => <CheckinRank /> },
  trendingSearch: { key: 'trendingSearch', render: () => <TrendingSearch /> },
  footer: { key: 'footer', render: () => <Footer /> },
};

function normalizeBlocks(raw?: string[]): SidebarBlockKey[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((key): key is SidebarBlockKey => key in SIDEBAR_BLOCKS);
}

export function sidebarBlocksForPage(pageKey?: string, configured?: Record<string, string[]>): SidebarBlockKey[] {
  const pageBlocks = pageKey ? normalizeBlocks(configured?.[pageKey]) : [];
  if (pageBlocks.length) return pageBlocks;
  const defaultBlocks = normalizeBlocks(configured?.default);
  return defaultBlocks.length ? defaultBlocks : DEFAULT_RIGHT_BLOCKS;
}

export function RightSidebar({ blocks = DEFAULT_RIGHT_BLOCKS }: { blocks?: SidebarBlockKey[] }) {
  const { modules } = useSite();
  return (
    <>
      {blocks.map((key) => {
        const block = SIDEBAR_BLOCKS[key];
        if (!block || !moduleOn(modules, block.module)) return null;
        return <Fragment key={key}>{block.render()}</Fragment>;
      })}
    </>
  );
}

export function DefaultRightSidebar({ pageKey }: { pageKey?: string }) {
  const { sidebars } = useSite();
  return <RightSidebar blocks={sidebarBlocksForPage(pageKey, sidebars)} />;
}
