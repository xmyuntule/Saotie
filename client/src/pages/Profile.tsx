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
import { useSite } from '../context/SiteContext';
import api from '../api/client';
import { confirmDialog } from '../components/confirm';
import { reportDialog } from '../components/report';
import { fmtNum, GENDER, timeAgo } from '../lib/format';
import { buildKeywords, useSeo } from '../hooks/usePageTitle';

function UserList({ username, rel, isMe }: { username: any; rel: string; isMe: boolean }) {
  const nav = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
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
      {users.map((u: any) => (
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

const SYNC_TEMPLATE_VARS = [
  { key: 'title', token: '{title}', label: '标题' },
  { key: 'summary', token: '{summary}', label: '摘要' },
  { key: 'content', token: '{content}', label: '内容截取' },
  { key: 'sourceUrl', token: '{sourceUrl}', label: '原文链接' },
];
const DEFAULT_SYNC_PARTS = ['title', 'summary', 'sourceUrl'];
const CONTENT_SYNC_PARTS = ['title', 'content', 'sourceUrl'];

function syncTemplateFromParts(parts: string[]) {
  const allowed = new Set(SYNC_TEMPLATE_VARS.map((v) => v.key));
  const picked = parts.filter((p) => allowed.has(p));
  return (picked.length ? picked : DEFAULT_SYNC_PARTS)
    .map((key) => `{${key}}`)
    .join('\n\n');
}

function syncPartsFromTemplate(template: string) {
  const matches = [...String(template || '').matchAll(/\{(title|summary|content|sourceUrl)\}/g)]
    .map((m) => m[1]);
  return [...new Set(matches.length ? matches : DEFAULT_SYNC_PARTS)];
}

function syncStatusLabel(status: string) {
  const map: Record<string, string> = {
    published: '已发布',
    failed: '失败',
    skipped: '已跳过',
  };
  return map[status] || status || '已发布';
}

function ExternalSyncPanel() {
  const toast = useToast();
  const { patchUser } = useAuth();
  const site = useSite();
  const defaultName = site.name || '站点名称';
  const defaultRssUrl = 'https://Saotie.com/feed';
  const [data, setData] = useState<any | null>(null);
  const [form, setForm] = useState<any>({
    name: defaultName,
    rssUrl: defaultRssUrl,
    template: syncTemplateFromParts(DEFAULT_SYNC_PARTS),
    templateParts: DEFAULT_SYNC_PARTS,
    enabled: true,
    maxImages: '3',
    fetchIntervalMin: '60',
  });
  const [busy, setBusy] = useState('');
  const [expanded, setExpanded] = useState(false);
  const load = async () => {
    const { data: res } = await api.get('/external-sync/me');
    setData(res);
    const source = res.source;
    const template = source?.template || res.defaultTemplate || syncTemplateFromParts(DEFAULT_SYNC_PARTS);
    const templateParts = syncPartsFromTemplate(template);
    setForm({
      name: source?.name || defaultName,
      rssUrl: source?.rssUrl || defaultRssUrl,
      template: syncTemplateFromParts(templateParts),
      templateParts,
      enabled: source ? !!source.enabled : true,
      maxImages: String(source?.maxImages ?? 3),
      fetchIntervalMin: String(source?.fetchIntervalMin ?? 60),
    });
  };
  useEffect(() => { load().catch(() => setData({ config: { enabled: false, canUse: false, reason: '站外同步暂不可用', contentExcerptLen: 120 }, source: null, imports: [], defaultTemplate: '' })); }, [defaultName]);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const setTemplateParts = (parts: string[]) => {
    const next = parts.length ? parts : DEFAULT_SYNC_PARTS;
    setForm((f: any) => ({
      ...f,
      templateParts: next,
      template: syncTemplateFromParts(next),
    }));
  };
  const toggleTemplatePart = (key: string) => {
    const current = Array.isArray(form.templateParts) ? form.templateParts : DEFAULT_SYNC_PARTS;
    setTemplateParts(current.includes(key) ? current.filter((p: string) => p !== key) : [...current, key]);
  };
  const save = async () => {
    if (!form.rssUrl.trim()) return toast.err('请填写 RSS 地址');
    setBusy('save');
    try {
      await api.put('/external-sync/me', {
        name: form.name.trim() || defaultName,
        rssUrl: form.rssUrl.trim(),
        template: syncTemplateFromParts(form.templateParts || DEFAULT_SYNC_PARTS),
        enabled: !!form.enabled,
        maxImages: Math.max(0, Math.min(9, Math.round(Number(form.maxImages) || 0))),
        fetchIntervalMin: Math.max(10, Math.min(1440, Math.round(Number(form.fetchIntervalMin) || 60))),
      });
      toast.ok('RSS 同步配置已保存');
      await load();
    } catch (e: any) { toast.err(e.message); }
    finally { setBusy(''); }
  };
  const fetchNow = async () => {
    setBusy('fetch');
    try {
      const { data: res } = await api.post('/external-sync/me/fetch');
      if (res.user) patchUser(res.user);
      toast.ok(`同步完成：新增 ${res.imported || 0}，跳过 ${res.skipped || 0}，失败 ${res.failed || 0}`);
      if (res.errors?.length) toast.err(res.errors.slice(0, 2).join('；'));
      await load();
    } catch (e: any) { toast.err(e.message); }
    finally { setBusy(''); }
  };
  const remove = async () => {
    if (!(await confirmDialog('删除后会清理该 RSS 的同步记录，后续重新添加会重新去重。', { title: '删除 RSS 同步？', confirmText: '删除' }))) return;
    setBusy('delete');
    try {
      await api.delete('/external-sync/me');
      toast.ok('RSS 同步已删除');
      await load();
    } catch (e: any) { toast.err(e.message); }
    finally { setBusy(''); }
  };

  if (!data) return <div className="ui-card" style={{ padding: 18 }}><Loading /></div>;
  const cfg = data.config || {};
  const source = data.source;
  const disabledReason = !cfg.enabled ? '站外同步尚未开启' : (!cfg.canUse ? cfg.reason : '');
  const contentExcerptLen = cfg.contentExcerptLen || 120;
  const templatePreview = syncTemplateFromParts(form.templateParts || DEFAULT_SYNC_PARTS);
  const statusText = disabledReason ? '未开放' : source ? (source.enabled ? '已启用' : '已停用') : '未配置';
  const toggleExpanded = () => {
    if (disabledReason) {
      toast.err(disabledReason);
      return;
    }
    setExpanded((v) => !v);
  };
  return (
    <div className="ui-card" style={{ padding: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <button type="button" onClick={toggleExpanded} style={{ minWidth: 0, flex: 1, textAlign: 'left', background: 'transparent', border: 0, padding: 0, color: 'inherit', cursor: 'pointer' }}>
          <div style={{ fontWeight: 800, fontSize: 15.5, display: 'flex', gap: 7, alignItems: 'center' }}>
            <Icon name="link" size={16} style={{ color: 'var(--brand)' }} /> 站外同步
          </div>
          <div className="faint" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.55 }}>
            绑定个人 RSS 后，系统会按间隔同步新内容为公开动态；
            <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4, padding: '1px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--gold) 20%, transparent)', color: 'var(--gold-deep)', fontWeight: 800, whiteSpace: 'nowrap' }}>
              消耗 {cfg.costPerPost || 0} 积分/条
            </span>
          </div>
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={toggleExpanded}
          style={{
            minWidth: 64,
            maxWidth: 86,
            justifyContent: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            paddingInline: 10,
            color: source?.enabled && !disabledReason ? 'var(--good)' : 'var(--ink-2)',
            background: source?.enabled && !disabledReason ? 'color-mix(in srgb, var(--good) 14%, var(--surface-2))' : 'var(--surface-2)',
            borderColor: source?.enabled && !disabledReason ? 'color-mix(in srgb, var(--good) 34%, var(--line))' : 'var(--line)',
          }}
        >
          {statusText}
        </button>
      </div>

      {!expanded && disabledReason && (
        <div className="faint" style={{ marginTop: 10, fontSize: 12.5 }}>点击右上角状态可查看使用要求。</div>
      )}

      {expanded && disabledReason ? (
        <div className="ui-card" style={{ marginTop: 14, padding: 14, background: 'var(--surface-2)' }}>
          <div style={{ fontWeight: 700 }}>当前无法使用</div>
          <div className="faint" style={{ marginTop: 4, fontSize: 13 }}>{disabledReason}</div>
        </div>
      ) : expanded ? (
        <>
          <div className="sec-grid" style={{ marginTop: 14 }}>
            <label className="sec-field"><span className="sec-label">同步名称</span><input className="inp" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={defaultName} /></label>
            <label className="sec-field"><span className="sec-label">RSS 地址</span><input className="inp" value={form.rssUrl} onChange={(e) => set('rssUrl', e.target.value)} placeholder={defaultRssUrl} /></label>
            <label className="sec-field"><span className="sec-label">本地化图片数</span><input className="inp" type="number" min={0} max={9} value={form.maxImages} onChange={(e) => set('maxImages', e.target.value)} /></label>
            <label className="sec-field"><span className="sec-label">同步间隔（分钟）</span><input className="inp" type="number" min={10} max={1440} value={form.fetchIntervalMin} onChange={(e) => set('fetchIntervalMin', e.target.value)} /></label>
          </div>
          <div className="field" style={{ display: 'block', marginTop: 12 }}>
            <span className="sec-label">动态模板</span>
            <div className="row gap-8" style={{ flexWrap: 'wrap', marginTop: 8 }}>
              {SYNC_TEMPLATE_VARS.map((v) => {
                const active = (form.templateParts || DEFAULT_SYNC_PARTS).includes(v.key);
                return (
                  <button key={v.key} type="button" className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`} onClick={() => toggleTemplatePart(v.key)}>
                    {v.label} <span className="faint">{v.token}</span>
                  </button>
                );
              })}
            </div>
            <div className="row gap-8" style={{ flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTemplateParts(DEFAULT_SYNC_PARTS)}>标题 + 摘要 + 链接</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTemplateParts(CONTENT_SYNC_PARTS)}>标题 + 内容截取 + 链接</button>
            </div>
            <div className="ui-card" style={{ marginTop: 8, minHeight: 92, height: 'auto', padding: '12px 14px', lineHeight: 1.75, whiteSpace: 'pre-wrap', color: 'var(--ink)', background: 'var(--surface-2)', overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{templatePreview}</div>
            <div className="faint" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
              <div>1、可用变量：{'{title}'}、{'{summary}'}、{'{content}'}、{'{sourceUrl}'}。建议使用摘要，不要同步全文。</div>
              <div>2、如无摘要可选 {'{content}'}，内容自动截取前 {contentExcerptLen} 中文字符。</div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 14, gap: 12, flexWrap: 'wrap' }}>
            <label className="row gap-8" style={{ fontSize: 13 }}><input type="checkbox" checked={!!form.enabled} onChange={(e) => set('enabled', e.target.checked)} /> 启用自动同步</label>
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              {source && <button className="btn btn-ghost btn-sm danger" onClick={remove} disabled={!!busy}><Icon name="trash" size={14} /> 删除</button>}
              {source && <button className="btn btn-ghost btn-sm" onClick={fetchNow} disabled={!!busy || !form.enabled}>{busy === 'fetch' ? '同步中...' : '手动同步'}</button>}
              <button className="btn btn-primary btn-sm" onClick={save} disabled={!!busy}>{busy === 'save' ? '保存中...' : '保存配置'}</button>
            </div>
          </div>
        </>
      ) : null}

      {expanded && data.imports?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="sec-label" style={{ marginBottom: 8 }}>最近同步</div>
          {data.imports.slice(0, 5).map((r: any, i: number) => (
            <div key={r.id}>
              {i > 0 && <div className="divider" />}
              <div className="row gap-10" style={{ padding: '9px 0' }}>
                <span className="badge" style={{ minWidth: 58, maxWidth: 72, justifyContent: 'center', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{syncStatusLabel(r.status)}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                  <div className="faint" style={{ fontSize: 12 }}>{timeAgo(r.createdAt)}</div>
                </div>
                {r.postId && <Link className="btn btn-ghost btn-sm" to={`/post/${r.postId}`}>查看</Link>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const { username } = useParams();
  const nav = useNavigate();
  const { user: me, setAuthOpen } = useAuth();
  const toast = useToast();
  const { openCompose } = useCompose();
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [postsMore, setPostsMore] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [tab, setTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [likedPosts, setLikedPosts] = useState<any>(null);
  const [likedMore, setLikedMore] = useState(false);
  const [likedBusy, setLikedBusy] = useState(false);
  const [threads, setThreads] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [followBusy, setFollowBusy] = useState(false);
  const [visitorTotal, setVisitorTotal] = useState(0);
  const displayName = user?.nickname || user?.username || username;
  const profileBio = user?.bio && !user.bio.startsWith('emoji:') ? user.bio : '';
  const profileImage = user?.avatar && !String(user.avatar).startsWith('emoji:') ? user.avatar : user?.cover;

  useSeo({
    title: displayName ? `${displayName}的个人主页` : '个人主页',
    description: profileBio || (displayName ? `${displayName} 在 Saotie 的个人主页，查看动态、帖子与社区资料。` : 'Saotie 用户个人主页'),
    keywords: buildKeywords([user?.nickname, user?.username, user?.location, user?.title, '个人主页'], ['Saotie', '用户']),
    image: profileImage,
    path: username ? `/u/${username}` : null,
    type: 'profile',
  });

  const loadProfile = () => api.get(`/users/${username}`).then(({ data }) => setUser(data.user)).catch(() => setUser(null));
  const loadMoreLiked = () => {
    setLikedBusy(true);
    api.get(`/posts/liked/${username}`, { params: { limit: 20, offset: (likedPosts || []).length } })
      .then(({ data }) => { setLikedPosts((x: any[]) => [...(x || []), ...data.posts]); setLikedMore(!!data.hasMore); })
      .catch(() => undefined)
      .finally(() => setLikedBusy(false));
  };
  const loadMorePosts = () => {
    setMoreBusy(true);
    api.get(`/posts/user/${username}`, { params: { limit: 20, offset: posts.length } })
      .then(({ data }) => { setPosts((x) => [...x, ...data.posts]); setPostsMore(!!data.hasMore); })
      .catch(() => undefined)
      .finally(() => setMoreBusy(false));
  };
  useEffect(() => {
    setLoading(true); setTab('posts'); setLikedPosts(null); setThreads(null); setPostsMore(false);
    Promise.all([loadProfile(), api.get(`/posts/user/${username}`, { params: { limit: 20 } }).then(({ data }) => { setPosts(data.posts); setPostsMore(!!data.hasMore); }).catch(() => setPosts([]))])
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (tab === 'liked' && likedPosts === null)
      api.get(`/posts/liked/${username}`, { params: { limit: 20 } }).then(({ data }) => { setLikedPosts(data.posts); setLikedMore(!!data.hasMore); }).catch(() => setLikedPosts([]));
    if (tab === 'threads' && threads === null)
      api.get(`/forum/threads/user/${username}`).then(({ data }) => setThreads(data.threads)).catch(() => setThreads([]));
  }, [tab, username, likedPosts, threads]);

  // earned achievement badges (a wall on the profile)
  useEffect(() => {
    if (!user?.id) { setBadges([]); return; }
    api.get(`/achievements/user/${user.id}/badges`)
      .then(({ data }) => setBadges((data.badges || []).filter((bb: any) => bb.unlocked)))
      .catch(() => setBadges([]));
  }, [user?.id]);

  // 最近访客 — only the profile owner sees who's visited
  useEffect(() => {
    setVisitors([]); setVisitorTotal(0);
    if (!user?.id || me?.id !== user.id) return;
    api.get(`/users/${user.username}/visitors`)
      .then(({ data }) => { setVisitors(data.visitors || []); setVisitorTotal(data.total || 0); })
      .catch(() => {});
  }, [user?.id, me?.id, user?.username]);

  if (loading) return <Shell right={false}><ProfileSkeleton /><PostSkeleton /><PostSkeleton /></Shell>;
  if (!user) return <Shell right={false}><div className="ui-card"><Empty icon="🔍" text="用户不存在" /></div></Shell>;

  const isMe = me?.id === user.id;
  const cover = user.cover && !user.cover.startsWith('emoji') ? { backgroundImage: `url(${user.cover})` } : {};

  const follow = async () => {
    if (!me) return setAuthOpen(true);
    if (followBusy) return;
    setFollowBusy(true);
    try {
      const { data } = await api.post(`/users/${user.id}/follow`);
      setUser(data.user);
      toast.ok(data.following ? `已关注 ${user.nickname}` : '已取消关注');
    } catch (e: any) { toast.err(e.message); }
    finally { setFollowBusy(false); }
  };

  const blockUser = async () => {
    setMenuOpen(false);
    if (!(await confirmDialog('之后将不再看到 TA 的内容', { title: `拉黑 @${user.nickname}？`, confirmText: '拉黑' }))) return;
    try { await api.post(`/users/${user.id}/block`); toast.ok('已拉黑'); setUser((u: any) => ({ ...u, isFollowing: false })); }
    catch (e: any) { toast.err(e.message); }
  };
  const reportUser = async () => {
    setMenuOpen(false);
    const reason = await reportDialog();
    if (reason === null) return;
    try { await api.post('/reports', { targetType: 'user', targetId: user.id, reason }); toast.ok('举报已提交，感谢反馈'); }
    catch (e: any) { toast.err(e.message); }
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
                  <button className={`btn follow-btn ${user.isFollowing ? 'btn-ghost following' : 'btn-primary'}`} onClick={follow} disabled={followBusy}>
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

      {isMe && <ExternalSyncPanel />}

      {badges.length > 0 && (
        <div className="ui-card pf-badges">
          <div className="pf-badges-head">
            <div className="pf-badges-title"><Icon name="shield" size={16} /> 勋章 <span className="pf-badges-n">{badges.length}</span></div>
            {isMe && <Link to="/achievements" className="pf-badges-more">查看全部</Link>}
          </div>
          <div className="pf-badge-row">
            {badges.slice(0, 12).map((bb) => (
              <div key={bb.key} className={`pf-badge tier-${bb.tier}`} title={`${bb.name} · ${bb.desc}`}>
                <span className="pf-medal"><Icon name={bb.icon} size={21} /></span>
                <span className="pf-badge-name">{bb.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isMe && visitors.length > 0 && (
        <div className="ui-card pv-card">
          <div className="pv-head">
            <span className="pv-title"><Icon name="eye" size={16} /> 最近访客 <span className="pv-n">{visitorTotal}</span></span>
          </div>
          <div className="pv-list">
            {visitors.slice(0, 12).map((v) => (
              <Link key={v.id} to={`/u/${v.username}`} className="pv-item" title={`${v.nickname} · ${timeAgo(v.visitedAt)}看过`}>
                <Avatar user={v} size={44} showV />
                <span className="pv-name nowrap">{v.nickname}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

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
          : threads.map((t: any, i: number) => <div key={t.id}>{i > 0 && <div className="divider" />}<ThreadRow thread={t} /></div>))}
      </div>

      {tab === 'posts' && (posts.length === 0 ? <div className="ui-card"><Empty icon="✍️" text={isMe ? '你还没有发布动态' : 'TA 还没有发布动态'}>
        {isMe && <button className="btn btn-primary btn-sm" onClick={openCompose}><Icon name="edit" size={14} /> 发布第一条动态</button>}
      </Empty></div>
        : <>
          {posts.map((p: any) => <PostCard key={p.id} post={p} onDelete={(id: number) => setPosts((x) => x.filter((y) => y.id !== id))} />)}
          {postsMore && <div className="row" style={{ justifyContent: 'center', padding: '6px 0 2px' }}>
            <button className="btn btn-ghost btn-sm" disabled={moreBusy} onClick={loadMorePosts}>{moreBusy ? '加载中…' : '加载更多'}</button>
          </div>}
        </>)}

      {tab === 'liked' && (likedPosts === null ? <Loading />
        : likedPosts.length === 0 ? <div className="ui-card"><Empty icon="❤️" text={isMe ? '你还没有赞过动态' : 'TA 还没有公开的点赞'}>{isMe && <button className="btn btn-primary btn-sm" onClick={() => nav('/discover')}>去发现好内容</button>}</Empty></div>
        : <>
          {likedPosts.map((p: any) => <PostCard key={p.id} post={p} />)}
          {likedMore && <div className="row" style={{ justifyContent: 'center', padding: '6px 0 2px' }}>
            <button className="btn btn-ghost btn-sm" disabled={likedBusy} onClick={loadMoreLiked}>{likedBusy ? '加载中…' : '加载更多'}</button>
          </div>}
        </>)}
    </Shell>
  );
}
