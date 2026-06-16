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
import AIChat from './pages/AIChat';
import Notifications from './pages/Notifications';
import Member from './pages/Member';
import Search from './pages/Search';
import Settings from './pages/Settings';
import Mall from './pages/Mall';
import Bookmarks from './pages/Bookmarks';
import Changelog from './pages/Changelog';
import Leaderboard from './pages/Leaderboard';
import Flash from './pages/Flash';
import Circles from './pages/Circles';
import CircleDetail from './pages/CircleDetail';
import QA from './pages/QA';
import QADetail from './pages/QADetail';
import Achievements from './pages/Achievements';
import Nav from './pages/Nav';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

export default function App() {
  const { user, loading } = useAuth();
  // Auth wall — registration/login required to use the app.
  if (loading) return <div className="auth-splash"><div className="ui-spinner" /></div>;
  if (!user) return <AuthLanding />;
  return (
    <Routes>
      {/* Admin is a standalone console — outside the social Layout (no social nav/tabbar/FAB) */}
      <Route path="/admin/*" element={<Admin />} />
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
        <Route path="/assistant" element={<AIChat />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/member" element={<Member />} />
        <Route path="/mall" element={<Mall />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/flash" element={<Flash />} />
        <Route path="/circles" element={<Circles />} />
        <Route path="/circle/:slug" element={<CircleDetail />} />
        <Route path="/qa" element={<QA />} />
        <Route path="/qa/:id" element={<QADetail />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/nav" element={<Nav />} />
        <Route path="/search" element={<Search />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
