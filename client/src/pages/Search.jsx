import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import PostCard from '../components/PostCard';
import FollowButton from '../components/FollowButton';
import { Badges } from '../components/Identity';
import { Loading, Empty } from '../components/States';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { fmtNum } from '../lib/format';

const TABS = [{ k: 'all', l: '综合' }, { k: 'users', l: '用户' }, { k: 'posts', l: '动态' }, { k: 'threads', l: '帖子' }, { k: 'topics', l: '话题' }];

export default function Search() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { user: me } = useAuth();
  const q = sp.get('q') || '';
  const [input, setInput] = useState(q);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('haha_search_history') || '[]'); } catch { return []; } });
  const [trending, setTrending] = useState([]);

  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => { api.get('/search/trending').then(({ data }) => setTrending(data.keywords)).catch(() => {}); }, []);
  useEffect(() => {
    if (!q) { setRes(null); setLoading(false); return; }
    setLoading(true);
    setHistory((h) => { const next = [q, ...h.filter((x) => x !== q)].slice(0, 10); try { localStorage.setItem('haha_search_history', JSON.stringify(next)); } catch {} return next; });
    api.get('/search', { params: { q } }).then(({ data }) => setRes(data)).finally(() => setLoading(false));
  }, [q]);

  const has = (k) => res && res[k]?.length > 0;
  const submit = (e) => { e.preventDefault(); if (input.trim()) nav(`/search?q=${encodeURIComponent(input.trim())}`); };
  const clearHistory = () => { setHistory([]); try { localStorage.removeItem('haha_search_history'); } catch {} };

  return (
    <Shell>
      <form className="ui-card section-head" onSubmit={submit} style={{ gap: 10 }}>
        <Icon name="search" size={18} style={{ color: 'var(--ink-3)', flex: 'none' }} />
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="搜索用户、动态、帖子、话题…" autoFocus={!q}
          style={{ flex: 1, height: 38, border: 'none', outline: 'none', background: 'transparent', fontSize: 15.5 }} />
        <button className="btn btn-primary btn-sm" type="submit">搜索</button>
      </form>
      {q && <div className="muted" style={{ padding: '0 20px', fontSize: 13 }}>“{q}” 的搜索结果</div>}
      {q && (
        <div className="ui-card feed-tabs">
          {TABS.map((t) => <button key={t.k} className={`feed-tab${tab === t.k ? ' active' : ''}`} onClick={() => setTab(t.k)}>{t.l}</button>)}
        </div>
      )}

      {!q ? (
        <>
          {history.length > 0 && (
            <div className="ui-card widget">
              <div className="widget-head"><div className="widget-title"><Icon name="back" size={14} className="tk" style={{ transform: 'rotate(0deg)' }} /> 最近搜索</div><button className="widget-more" onClick={clearHistory}>清空</button></div>
              <div className="kw-list">{history.map((h) => <button className="kw" key={h} onClick={() => nav(`/search?q=${encodeURIComponent(h)}`)}>{h}</button>)}</div>
            </div>
          )}
          {trending.length > 0 && (
            <div className="ui-card widget">
              <div className="widget-head"><div className="widget-title"><Icon name="fire" size={15} className="tk" /> 热搜榜</div></div>
              <div className="kw-list">{trending.map((k) => <button className="kw" key={k} onClick={() => nav(`/search?q=${encodeURIComponent(k)}`)}>{k}</button>)}</div>
            </div>
          )}
          {history.length === 0 && trending.length === 0 && <div className="ui-card"><Empty icon="🔍" text="输入关键词搜索" /></div>}
        </>
      ) : loading ? <Loading /> : !res ? <div className="ui-card"><Empty text="输入关键词搜索" /></div> : (
        <>
          {(tab === 'all' || tab === 'users') && has('users') && (
            <div className="ui-card" style={{ padding: '8px 18px' }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, padding: '8px 0' }}>用户</div>
              {res.users.map((u) => (
                <div className="user-row" key={u.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <Avatar user={u} size={44} showV />
                  <div className="meta nowrap"><Link to={`/u/${u.username}`} className="nm uname">{u.nickname} <Badges user={u} showLevel={false} /></Link><div className="sub nowrap">@{u.username} · {fmtNum(u.followers)} 粉丝</div></div>
                  {me && me.id !== u.id && <button className="btn btn-ghost btn-sm" onClick={() => nav(`/messages/${u.id}`)}><Icon name="mail" size={14} /></button>}
                  <FollowButton user={u} />
                </div>
              ))}
            </div>
          )}
          {(tab === 'all' || tab === 'topics') && has('topics') && (
            <div className="ui-card" style={{ padding: '8px 18px' }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, padding: '8px 0' }}>话题</div>
              {res.topics.map((t) => (
                <Link to={`/topic/${encodeURIComponent(t.name)}`} key={t.id} className="row gap-8" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                  <Icon name="fire" size={16} style={{ color: 'var(--like)' }} /><span style={{ fontWeight: 700 }}>#{t.name}#</span><span className="faint" style={{ fontSize: 12 }}>{fmtNum(t.post_count || 0)} 动态</span>
                </Link>
              ))}
            </div>
          )}
          {(tab === 'all' || tab === 'threads') && has('threads') && (
            <div className="ui-card" style={{ padding: '8px 18px' }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700, padding: '8px 0' }}>帖子</div>
              {res.threads.map((t) => (
                <Link to={`/thread/${t.id}`} key={t.id} className="row gap-8" style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                  <Icon name="forum" size={16} style={{ color: 'var(--brand)' }} /><span className="grow" style={{ fontWeight: 600 }}>{t.title}</span><span className="faint" style={{ fontSize: 12 }}>{fmtNum(t.replyCount)} 回复</span>
                </Link>
              ))}
            </div>
          )}
          {(tab === 'all' || tab === 'posts') && has('posts') && (
            <>{res.posts.map((p) => <PostCard key={p.id} post={p} />)}</>
          )}
          {res && (tab === 'all'
            ? (!has('users') && !has('posts') && !has('threads') && !has('topics'))
            : !has(tab)
          ) && (
            <div className="ui-card"><Empty icon="🔍" text={tab === 'all' ? '没有找到相关结果' : `没有找到相关的${TABS.find((t) => t.k === tab)?.l || '内容'}`} /></div>
          )}
        </>
      )}
    </Shell>
  );
}
