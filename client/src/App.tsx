import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
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

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-splash"><div className="ui-spinner" /></div>;
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
      {/* Social app — gated behind the auth wall (registration/login required) */}
      {!user ? (
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
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/:peerId" element={<Messages />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/member" element={<Member />} />
        <Route path="/mall" element={<Mall />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/history" element={<History />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/flash" element={<Flash />} />
        <Route path="/circles" element={<Circles />} />
        <Route path="/circle/:slug" element={<CircleDetail />} />
        <Route path="/qa" element={<QA />} />
        <Route path="/qa/:id" element={<QADetail />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/lottery" element={<Lottery />} />
        <Route path="/checkin" element={<Checkin />} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/article/:id" element={<ArticleDetail />} />
        <Route path="/write" element={<WriteArticle />} />
        <Route path="/events" element={<Events />} />
        <Route path="/event/:id" element={<EventDetail />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/collection/:id" element={<CollectionDetail />} />
        <Route path="/nav" element={<Nav />} />
        <Route path="/search" element={<Search />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/certification" element={<Certification />} />
        <Route path="/go" element={<ExternalRedirect />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      )}
    </Routes>
    </Suspense>
    </>
  );
}
