import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthLanding from './pages/AuthLanding';
import Layout from './components/Layout';
import Home from './pages/Home';
import Discover from './pages/Discover';
import Topic from './pages/Topic';
import Forum from './pages/Forum';
import Board from './pages/Board';
import ThreadDetail from './pages/ThreadDetail';
import PostDetail from './pages/PostDetail';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import Member from './pages/Member';
import Search from './pages/Search';
import Settings from './pages/Settings';
import Mall from './pages/Mall';
import Bookmarks from './pages/Bookmarks';
import History from './pages/History';
import Changelog from './pages/Changelog';
import Leaderboard from './pages/Leaderboard';
import Flash from './pages/Flash';
import Circles from './pages/Circles';
import CircleDetail from './pages/CircleDetail';
import QA from './pages/QA';
import QADetail from './pages/QADetail';
import Achievements from './pages/Achievements';
import Lottery from './pages/Lottery';
import Checkin from './pages/Checkin';
import Articles from './pages/Articles';
import ArticleDetail from './pages/ArticleDetail';
import WriteArticle from './pages/WriteArticle';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Nav from './pages/Nav';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-splash"><div className="ui-spinner" /></div>;
  return (
    <Routes>
      {/* 后台是独立入口：/admin 自带登录 + 权限校验，不经过社交端登录墙（即使未登录也能直达后台登录页） */}
      <Route path="/admin/*" element={<Admin />} />
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
        <Route path="/nav" element={<Nav />} />
        <Route path="/search" element={<Search />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      )}
    </Routes>
  );
}
