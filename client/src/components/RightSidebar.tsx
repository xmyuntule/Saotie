import { Fragment, type ReactNode } from 'react';
import { useSite, moduleOn } from '../context/SiteContext';
import {
  CheckinRank,
  CircleWidget,
  FlashWidget,
  Footer,
  HotTopics,
  ProfileBadgesWidget,
  ProfileVisitorsWidget,
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
  | 'footer'
  | 'profileBadges'
  | 'profileVisitors';

export type RenderableSidebarBlockKey = SidebarBlockKey | string;

export type SidebarBlock = {
  key: RenderableSidebarBlockKey;
  label: string;
  module?: string;
  defaults?: SidebarSettings;
  settings?: SidebarSetting[];
  render: (context?: SidebarContext, settings?: SidebarSettings) => ReactNode;
};

export type SidebarSettings = Record<string, string | number>;

export type SidebarSetting = {
  key: string;
  label: string;
  options: { value: string | number; label: string }[];
};

export type SidebarContext = {
  pageKey?: string;
  profileUser?: any;
  isProfileOwner?: boolean;
};

export const PROFILE_SIDEBAR_BLOCKS = ['profileBadges', 'profileVisitors'];

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
  hotTopics: { key: 'hotTopics', label: '热门话题', module: 'discover', render: () => <HotTopics /> },
  qa: { key: 'qa', label: '悬赏求助', module: 'qa', render: () => <QAWidget /> },
  circles: { key: 'circles', label: '推荐圈子', module: 'circles', render: () => <CircleWidget /> },
  flash: { key: 'flash', label: '社区快报', module: 'flash', render: () => <FlashWidget /> },
  whoToFollow: {
    key: 'whoToFollow',
    label: '推荐关注',
    defaults: { limit: 5, sort: 'experience' },
    settings: [
      { key: 'sort', label: '推荐方式', options: [
        { value: 'experience', label: '等级优先' },
        { value: 'points', label: '积分优先' },
        { value: 'followers', label: '粉丝数量' },
        { value: 'newest', label: '最新注册' },
        { value: 'random', label: '随机推荐' },
      ] },
      { key: 'limit', label: '显示数量', options: [{ value: 5, label: '5 人' }, { value: 10, label: '10 人' }] },
    ],
    render: (_context, settings) => <WhoToFollow limit={Number(settings?.limit) || 5} sort={String(settings?.sort || 'experience')} />,
  },
  checkinRank: { key: 'checkinRank', label: '签到排行榜', module: 'checkin', render: () => <CheckinRank /> },
  trendingSearch: { key: 'trendingSearch', label: '热搜榜', render: () => <TrendingSearch /> },
  footer: { key: 'footer', label: '页脚信息', render: () => <Footer /> },
  profileBadges: {
    key: 'profileBadges',
    label: '个人勋章',
    defaults: { limit: 9 },
    settings: [{ key: 'limit', label: '显示数量', options: [{ value: 6, label: '6 枚' }, { value: 9, label: '9 枚' }, { value: 12, label: '12 枚' }] }],
    render: (context, settings) => <ProfileBadgesWidget profileUser={context?.profileUser} isOwner={!!context?.isProfileOwner} limit={Number(settings?.limit) || 9} />,
  },
  profileVisitors: {
    key: 'profileVisitors',
    label: '最近访客',
    defaults: { limit: 9 },
    settings: [{ key: 'limit', label: '显示数量', options: [{ value: 6, label: '6 人' }, { value: 9, label: '9 人' }, { value: 12, label: '12 人' }] }],
    render: (context, settings) => <ProfileVisitorsWidget profileUser={context?.profileUser} isOwner={!!context?.isProfileOwner} limit={Number(settings?.limit) || 9} />,
  },
};

function normalizeBlocks(raw?: string[]): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

export function sidebarBlocksForPage(
  pageKey?: string,
  configured?: Record<string, string[]>,
  fallbackBlocks?: string[],
): string[] {
  const pageBlocks = pageKey ? normalizeBlocks(configured?.[pageKey]) : [];
  if (pageBlocks.length) return pageBlocks;
  const fallback = normalizeBlocks(fallbackBlocks);
  if (fallback.length) return fallback;
  const defaultBlocks = normalizeBlocks(configured?.default);
  return defaultBlocks.length ? defaultBlocks : DEFAULT_RIGHT_BLOCKS;
}

export function sidebarOptionsForPage(
  pageKey?: string,
  configured?: Record<string, Record<string, SidebarSettings>>,
) {
  return {
    ...(configured?.default || {}),
    ...(pageKey ? configured?.[pageKey] || {} : {}),
  };
}

export function RightSidebar({
  blocks = DEFAULT_RIGHT_BLOCKS,
  customBlocks = {},
  options = {},
  context,
}: {
  blocks?: string[];
  customBlocks?: Record<string, SidebarBlock>;
  options?: Record<string, SidebarSettings>;
  context?: SidebarContext;
}) {
  const { modules } = useSite();
  return (
    <>
      {blocks.map((key) => {
        const block = customBlocks[key] || SIDEBAR_BLOCKS[key as SidebarBlockKey];
        if (!block || !moduleOn(modules, block.module)) return null;
        const settings = { ...(block.defaults || {}), ...(options[key] || {}) };
        return <Fragment key={key}>{block.render(context, settings)}</Fragment>;
      })}
    </>
  );
}

export function DefaultRightSidebar({
  pageKey,
  customBlocks,
  fallbackBlocks,
  context,
}: {
  pageKey?: string;
  customBlocks?: Record<string, SidebarBlock>;
  fallbackBlocks?: string[];
  context?: SidebarContext;
}) {
  const { sidebars, sidebarOptions } = useSite();
  return (
    <RightSidebar
      blocks={sidebarBlocksForPage(pageKey, sidebars, fallbackBlocks)}
      customBlocks={customBlocks}
      options={sidebarOptionsForPage(pageKey, sidebarOptions)}
      context={context}
    />
  );
}
