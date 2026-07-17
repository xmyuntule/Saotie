// Shared domain types for the TypeScript surface of the app.
// New code should import from here; the codebase is migrating .jsx → .tsx incrementally.

export interface PublicUser {
  id: number;
  username: string;
  nickname: string;
  avatar?: string;
  bio?: string;
  level?: number;
  role?: 'user' | 'admin';
  vip?: boolean;
  vipLevel?: number;
  vipExpires?: string | null;
  verified?: boolean;
  verifiedNote?: string;
  certType?: 'personal' | 'enterprise' | string;
  certLabel?: string;
  certApprovedAt?: string | null;
  title?: string;
  avatarFrame?: string;
  cover?: string;
  location?: string;
  gender?: string;
  // counters / stats commonly rendered in the UI
  postCount?: number;
  following?: number;
  followers?: number;
  points?: number;
  balance?: number;
  experience?: number;
  checkinStreak?: number;
  lastCheckin?: string;
  isFollowing?: boolean;
  anonymous?: boolean;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  [key: string]: unknown;
}

export type ArticleCategory = '综合' | '技术' | '设计' | '产品' | '生活' | '观点';

export interface Article {
  id: number;
  title: string;
  summary: string;
  cover: string;
  category: ArticleCategory | string;
  featured: boolean;
  views: number;
  likeCount: number;
  commentCount: number;
  readMins: number;
  createdAt: string;
  author: PublicUser;
  liked: boolean;
  content?: string; // only present on the detail endpoint
}

export interface ArticleCategoryCount {
  name: string;
  count: number;
}

export interface ArticleListResponse {
  featured: Article | null;
  articles: Article[];
  categories: ArticleCategoryCount[];
  total: number;
  hasMore?: boolean;
}

export interface ArticleDetailResponse {
  article: Article;
  related: Article[];
}

export type EventStatus = 'upcoming' | 'ongoing' | 'ended';

export interface CommunityEvent {
  id: number;
  title: string;
  cover: string;
  location: string;
  category: string;
  startAt: string;
  endAt: string;
  capacity: number;
  fee: number;
  online: boolean;
  signupCount: number;
  spotsLeft: number | null;
  status: EventStatus;
  full: boolean;
  signed: boolean;
  organizer: PublicUser;
  isOrganizer: boolean;
  description?: string;
}

export interface EventListResponse {
  events: CommunityEvent[];
  categories: string[];
  counts: { upcoming: number };
}

export interface EventDetailResponse {
  event: CommunityEvent;
  attendees: PublicUser[];
}

export interface RedPacketGrab {
  user: PublicUser;
  amount: number;
}

export interface RedPacketData {
  id: number;
  blessing: string;
  totalPoints: number;
  totalCount: number;
  grabbedCount: number;
  grabbedPoints: number;
  over: boolean;
  isOwner: boolean;
  myAmount: number | null; // null => the viewer hasn't grabbed yet
  bestUserId: number | null;
  grabs: RedPacketGrab[];
}

export interface CommentAuthor extends PublicUser {}

export interface CommentNode {
  id: number;
  content: string;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  parentId: number | null;
  replyTo: PublicUser | null;
  author: PublicUser;
  replies: CommentNode[];
}
