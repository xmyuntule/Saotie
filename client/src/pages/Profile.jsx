import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import PostCard from '../components/PostCard';
import FollowButton from '../components/FollowButton';
import ThreadRow from '../components/ThreadRow';
import { Badges } from '../components/Identity';
import { Loading, Empty, ProfileSkeleton, PostSkeleton } from '../components/States';
import { CheckinRank, TrendingSearch, Footer } from '../components/Widgets';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCompose } from '../context/ComposeContext';
import api from '../api/client';
import { fmtNum, GENDER } from '../lib/format';

function UserList({ username, rel, isMe }) {
  const nav = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get(`/users/${username}/${rel}`).then(({ data }) => setUsers(data.users)).finally(() => setLoading(false)); }, [username, rel]);
  if (loading) return <Loading />;
  if (!users.length) return (
    <Empty icon="👥" text={rel === 'followers' ? '还没有粉丝' : '还没有关注任何人'}>
      {isMe && rel === 'following' && <button className="btn btn-primary btn-sm" onClick={() => nav('/discover')}>去发现感兴趣的人</button>}
    </Empty>
  );
  return (
    <div style={{ padding: '4px 18px' }}>
      {users.map((u) => (
        <div className="user-row" key={u.id} style={{ borderTop: '1px solid var(--line)' }}>
          <Avatar user={u} size={46} showV />
          <div className="meta nowrap">
            <Link to={`/u/${u.username}`} className="nm uname" style={{ fontSize: 15 }}>{u.nickname} <Badges user={u} showLevel={false} /></Link>
            <div className="sub nowrap">{!u.bio || u.bio.startsWith('emoji:') ? `Lv.${u.level} · ${fmtNum(u.followers)} 粉丝` : u.bio}</div>
          </div>
          <FollowButton user={u} />
        </div>
      ))}
    </div>
  );
}

export default function Profile() {
  const { username } = useParams();
  const nav = useNavigate();
  const { user: me, setAuthOpen } = useAuth();
  const toast = useToast();
  const { openCompose } = useCompose();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [likedPosts, setLikedPosts] = useState(null);
  const [threads, setThreads] = useState(null);

  const loadProfile = () => api.get(`/users/${username}`).then(({ data }) => setUser(data.user)).catch(() => setUser(null));
  useEffect(() => {
    setLoading(true); setTab('posts'); setLikedPosts(null); setThreads(null);
    Promise.all([loadProfile(), api.get(`/posts/user/${username}`).then(({ data }) => setPosts(data.posts)).catch(() => setPosts([]))])
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (tab === 'liked' && likedPosts === null)
      api.get(`/posts/liked/${username}`).then(({ data }) => setLikedPosts(data.posts)).catch(() => setLikedPosts([]));
    if (tab === 'threads' && threads === null)
      api.get(`/forum/threads/user/${username}`).then(({ data }) => setThreads(data.threads)).catch(() => setThreads([]));
  }, [tab, username, likedPosts, threads]);

  if (loading) return <Shell right={false}><ProfileSkeleton /><PostSkeleton /><PostSkeleton /></Shell>;
  if (!user) return <Shell right={false}><div className="ui-card"><Empty icon="🔍" text="用户不存在" /></div></Shell>;

  const isMe = me?.id === user.id;
  const cover = user.cover && !user.cover.startsWith('emoji') ? { backgroundImage: `url(${user.cover})` } : {};

  const follow = async () => {
    if (!me) return setAuthOpen(true);
    try {
      const { data } = await api.post(`/users/${user.id}/follow`);
      setUser(data.user);
      toast.ok(data.following ? `已关注 ${user.nickname}` : '已取消关注');
    } catch (e) { toast.err(e.message); }
  };

  const blockUser = async () => {
    setMenuOpen(false);
    if (!confirm(`拉黑 @${user.nickname}？之后将不再看到 TA 的内容`)) return;
    try { await api.post(`/users/${user.id}/block`); toast.ok('已拉黑'); setUser((u) => ({ ...u, isFollowing: false })); }
    catch (e) { toast.err(e.message); }
  };
  const reportUser = async () => {
    setMenuOpen(false);
    const reason = prompt('举报原因（选填）：');
    if (reason === null) return;
    try { await api.post('/reports', { targetType: 'user', targetId: user.id, reason }); toast.ok('举报已提交'); }
    catch (e) { toast.err(e.message); }
  };

  const lp = user.levelProgress || { percent: 0, level: user.level, nextLevelExp: 0, exp: 0 };

  const right = (<><CheckinRank /><TrendingSearch /><Footer /></>);

  return (
    <Shell right={right}>
      <div className="ui-card profile-hero">
        <div className="profile-cover" style={cover} />
        <div className="profile-main">
          <div className="profile-top">
            <div className="profile-avatar"><Avatar user={user} size={88} showV /></div>
            <div className="profile-id">
              <div className="profile-name">
                <span className="pname-text">{user.nickname}</span>
                {user.gender && GENDER[user.gender] && <span style={{ fontSize: 16, color: user.gender === 'female' ? '#f06595' : '#4c6ef5' }}>{GENDER[user.gender]}</span>}
                <Badges user={user} />
              </div>
              <div className="profile-handle">@{user.username}</div>
            </div>
            <div className="row gap-8" style={{ paddingBottom: 4 }}>
              {isMe ? (
                <button className="btn btn-outline" onClick={() => nav('/settings')}><Icon name="edit" size={15} /> 编辑资料</button>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={() => nav(`/messages/${user.id}`)}><Icon name="mail" size={15} /> 私信</button>
                  <button className={`btn follow-btn ${user.isFollowing ? 'btn-ghost following' : 'btn-primary'}`} onClick={follow}>
                    {user.isFollowing
                      ? <><span className="fb-on">已关注</span><span className="fb-off">取消关注</span></>
                      : <><Icon name="plus" size={15} /> 关注</>}
                  </button>
                  {me && (
                    <div style={{ position: 'relative' }}>
                      <button className="post-menu" onClick={() => setMenuOpen((m) => !m)} aria-label="更多操作"><Icon name="more" size={18} /></button>
                      {menuOpen && (
                        <div className="ui-card menu-pop" onMouseLeave={() => setMenuOpen(false)}>
                          <button className="menu-item" onClick={reportUser}><Icon name="flag" size={16} /> 举报</button>
                          <button className="menu-item danger" onClick={blockUser}><Icon name="ban" size={16} /> 拉黑</button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {!user.bio?.startsWith('emoji:') && user.bio && <div className="profile-bio">{user.bio}</div>}
          <div className="profile-tags">
            {user.location && <span className="pt"><Icon name="location" size={14} /> {user.location}</span>}
            {user.verified && <span className="pt"><Icon name="check" size={14} style={{ color: 'var(--verify)' }} /> {user.verifiedNote || '认证用户'}</span>}
            <span className="pt"><Icon name="checkin" size={14} /> 连续签到 {user.checkinStreak} 天</span>
          </div>

          <div className="profile-stats">
            <button className="pstat" onClick={() => setTab('posts')}><b>{fmtNum(user.postCount)}</b><span>动态</span></button>
            <button className="pstat" onClick={() => setTab('following')}><b>{fmtNum(user.following)}</b><span>关注</span></button>
            <button className="pstat" onClick={() => setTab('followers')}><b>{fmtNum(user.followers)}</b><span>粉丝</span></button>
            <div className="pstat"><b style={{ color: 'var(--gold)' }}>{fmtNum(user.points)}</b><span>积分</span></div>
          </div>

          <div className="level-bar">
            <div className="lh"><span>等级 Lv.{lp.level}</span><span className="num">{lp.exp} / {lp.nextLevelExp} 经验</span></div>
            <div className="level-track"><div className="level-fill" style={{ width: `${lp.percent}%` }} /></div>
          </div>
        </div>
      </div>

      <div className="ui-card" style={{ overflow: 'hidden' }}>
        <div className="subtabs">
          <button className={`subtab${tab === 'posts' ? ' active' : ''}`} onClick={() => setTab('posts')}>动态 {user.postCount}</button>
          <button className={`subtab${tab === 'threads' ? ' active' : ''}`} onClick={() => setTab('threads')}>帖子</button>
          <button className={`subtab${tab === 'liked' ? ' active' : ''}`} onClick={() => setTab('liked')}>赞过</button>
          <button className={`subtab${tab === 'following' ? ' active' : ''}`} onClick={() => setTab('following')}>关注 {user.following}</button>
          <button className={`subtab${tab === 'followers' ? ' active' : ''}`} onClick={() => setTab('followers')}>粉丝 {user.followers}</button>
        </div>
        {(tab === 'following' || tab === 'followers') && <UserList username={username} rel={tab} isMe={isMe} />}
        {tab === 'threads' && (threads === null ? <Loading />
          : threads.length === 0 ? <Empty icon="📋" text={isMe ? '你还没有发过帖子' : 'TA 还没有发过帖子'}>{isMe && <button className="btn btn-primary btn-sm" onClick={() => nav('/forum')}>去论坛发帖</button>}</Empty>
          : threads.map((t, i) => <div key={t.id}>{i > 0 && <div className="divider" />}<ThreadRow thread={t} /></div>))}
      </div>

      {tab === 'posts' && (posts.length === 0 ? <div className="ui-card"><Empty icon="✍️" text={isMe ? '你还没有发布动态' : 'TA 还没有发布动态'}>
        {isMe && <button className="btn btn-primary btn-sm" onClick={openCompose}><Icon name="edit" size={14} /> 发布第一条动态</button>}
      </Empty></div>
        : posts.map((p) => <PostCard key={p.id} post={p} onDelete={(id) => setPosts((x) => x.filter((y) => y.id !== id))} />))}

      {tab === 'liked' && (likedPosts === null ? <Loading />
        : likedPosts.length === 0 ? <div className="ui-card"><Empty icon="❤️" text={isMe ? '你还没有赞过动态' : 'TA 还没有公开的点赞'}>{isMe && <button className="btn btn-primary btn-sm" onClick={() => nav('/discover')}>去发现好内容</button>}</Empty></div>
        : likedPosts.map((p) => <PostCard key={p.id} post={p} />))}
    </Shell>
  );
}
