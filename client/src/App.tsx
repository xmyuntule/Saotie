import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useSite } from './context/SiteContext';
import Layout from './components/Layout';
import Home from './pages/Home';
const AuthLanding = lazy(() => import('./pages/AuthLanding'));
const Mall = lazy(() => import('./pages/Mall'));
const Discover = lazy(() => import('./pages/Discover'));
const Topic = lazy(() => import('./pages/Topic'));
const Forum = lazy(() => import('./pages/Forum'));
const Board = lazy(() => import('./pages/Board'));
const ThreadDetail = lazy(() => import('./pages/ThreadDetail'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const Profile = lazy(() => import('./pages/Profile'));
const Messages = lazy(() => import('./pages/Messages'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Member = lazy(() => import('./pages/Member'));
const Search = lazy(() => import('./pages/Search'));
const Settings = lazy(() => import('./pages/Settings'));
const Certification = lazy(() => import('./pages/Certification'));
const ExternalRedirect = lazy(() => import('./pages/ExternalRedirect'));
const SharePage = lazy(() => import('./pages/SharePage'));
const Bookmarks = lazy(() => import('./pages/Bookmarks'));
const History = lazy(() => import('./pages/History'));
const Changelog = lazy(() => import('./pages/Changelog'));
const QA = lazy(() => import('./pages/QA'));
const QADetail = lazy(() => import('./pages/QADetail'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Flash = lazy(() => import('./pages/Flash'));
const Circles = lazy(() => import('./pages/Circles'));
const CircleDetail = lazy(() => import('./pages/CircleDetail'));
const Achievements = lazy(() => import('./pages/Achievements'));
const Lottery = lazy(() => import('./pages/Lottery'));
const Checkin = lazy(() => import('./pages/Checkin'));
const Articles = lazy(() => import('./pages/Articles'));
const ArticleDetail = lazy(() => import('./pages/ArticleDetail'));
const Collections = lazy(() => import('./pages/Collections'));
const CollectionDetail = lazy(() => import('./pages/CollectionDetail'));
const WriteArticle = lazy(() => import('./pages/WriteArticle'));
const Events = lazy(() => import('./pages/Events'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const Nav = lazy(() => import('./pages/Nav'));
const Admin = lazy(() => import('./pages/Admin'));
import About from './pages/About';
import NotFound from './pages/NotFound';
import { ConfirmHost } from './components/confirm';
import { ReportHost } from './components/report';
import { PromptHost } from './components/prompt';

function RouteFallback() {
  return <div className="center" style={{ padding: 48 }}><div className="ui-spinner" /></div>;
}

function RequireLogin({ children }: { children: ReactNode }) {
  const { user, setAuthOpen } = useAuth();
  const loc = useLocation();
  useEffect(() => {
    if (!user) {
      try { sessionStorage.setItem('haha_login_return', loc.pathname + loc.search); } catch { /* ignore */ }
      setAuthOpen(true);
    }
  }, [user, loc.pathname, loc.search, setAuthOpen]);
  if (!user) {
    return (
      <div className="center" style={{ padding: 24 }}>
        <div className="ui-card" style={{ padding: 24, textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>需要登录后访问</div>
          <div className="faint" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>登录后即可继续打开当前页面。</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setAuthOpen(true)}>登录 / 注册</button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();
  const site = useSite();
  if (loading) return <div className="auth-splash"><div className="ui-spinner" /></div>;
  const canBrowse = !!user || site.allowGuest !== false;
  return (
    <>
    <ConfirmHost />
    <ReportHost />
    <PromptHost />
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      {/* 后台是独立入口：/admin 自带登录 + 权限校验，不经过社交端登录墙（即使未登录也能直达后台登录页） */}
      <Route path="/admin/*" element={<Admin />} />
      {/* 官网/功能展示页 — 访客（未登录）也能查看 */}
      <Route path="/about" element={<About />} />
      {/* 站外分享发布页：允许未登录访问，页面内部完成登录后发布。 */}
      <Route path="/share" element={<SharePage />} />
      {/* 站长关闭访客浏览时恢复登录墙；默认公开页可浏览，互动操作再弹登录。 */}
      {!canBrowse ? (
        <Route path="*" element={<AuthLanding />} />
      ) : (
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/topic/:name" element={<Topic />} />
        <Route path="/forum" element={<Forum />} />
        <Route path="/forum/:slug" element={<Board />} />
        <Route path="/thread/:id" element={<ThreadDetail />} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/u/:username" element={<Profile />} />
        <Route path="/messages" element={<RequireLogin><Messages /></RequireLogin>} />
        <Route path="/messages/:peerId" element={<RequireLogin><Messages /></RequireLogin>} />
        <Route path="/notifications" element={<RequireLogin><Notifications /></RequireLogin>} />
        <Route path="/member" element={<RequireLogin><Member /></RequireLogin>} />
        <Route path="/mall" element={<Mall />} />
        <Route path="/bookmarks" element={<RequireLogin><Bookmarks /></RequireLogin>} />
        <Route path="/history" element={<RequireLogin><History /></RequireLogin>} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/flash" element={<Flash />} />
        <Route path="/circles" element={<Circles />} />
        <Route path="/circle/:slug" element={<CircleDetail />} />
        <Route path="/qa" element={<QA />} />
        <Route path="/qa/:id" element={<QADetail />} />
        <Route path="/achievements" element={<RequireLogin><Achievements /></RequireLogin>} />
        <Route path="/lottery" element={<Lottery />} />
        <Route path="/checkin" element={<RequireLogin><Checkin /></RequireLogin>} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/article/:id" element={<ArticleDetail />} />
        <Route path="/write" element={<RequireLogin><WriteArticle /></RequireLogin>} />
        <Route path="/events" element={<Events />} />
        <Route path="/event/:id" element={<EventDetail />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/collection/:id" element={<CollectionDetail />} />
        <Route path="/nav" element={<Nav />} />
        <Route path="/search" element={<Search />} />
        <Route path="/settings" element={<RequireLogin><Settings /></RequireLogin>} />
        <Route path="/certification" element={<RequireLogin><Certification /></RequireLogin>} />
        <Route path="/go" element={<ExternalRedirect />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      )}
    </Routes>
    </Suspense>
    </>
  );
}
