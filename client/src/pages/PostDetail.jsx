import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import PostCard from '../components/PostCard';
import Avatar from '../components/Avatar';
import { Loading, Empty } from '../components/States';
import api from '../api/client';
import { fmtNum } from '../lib/format';

function RelatedCard({ posts }) {
  if (!posts.length) return null;
  return (
    <div className="card widget">
      <div className="widget-title" style={{ marginBottom: 10 }}><Icon name="compass" size={16} className="tk" /> 相关推荐</div>
      {posts.map((p) => (
        <Link to={`/post/${p.id}`} key={p.id} className="related-row">
          <Avatar user={p.author} size={36} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="related-text">{p.content || '[图片/视频]'}</div>
            <div className="faint" style={{ fontSize: 11.5 }}>{p.author?.nickname} · ❤ {fmtNum(p.likeCount)}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function PostDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [siblings, setSiblings] = useState({ prev: null, next: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true); setRelated([]); setSiblings({ prev: null, next: null });
    api.get(`/posts/${id}`).then(({ data }) => setPost(data.post)).catch(() => setPost(null)).finally(() => setLoading(false));
    api.get(`/posts/${id}/related`).then(({ data }) => setRelated(data.posts)).catch(() => {});
    api.get(`/posts/${id}/siblings`).then(({ data }) => setSiblings(data)).catch(() => {});
  }, [id]);

  return (
    <Shell right={related.length ? <RelatedCard posts={related} /> : undefined}>
      <div className="card page-title">
        <button className="back-btn" onClick={() => nav(-1)} aria-label="返回"><Icon name="back" size={20} /></button>
        动态详情
      </div>
      {loading ? <Loading /> : !post ? <div className="card"><Empty icon="🔍" text="动态不存在或已删除" /></div>
        : (
          <>
            <PostCard post={post} defaultOpenComments />
            {(siblings.prev || siblings.next) && (
              <div className="card post-nav">
                {siblings.prev
                  ? <Link to={`/post/${siblings.prev.id}`} className="post-nav-item"><span className="pn-label"><Icon name="back" size={14} /> 上一条</span><span className="pn-text">{siblings.prev.content}</span></Link>
                  : <span className="post-nav-item is-off"><span className="pn-label">上一条</span><span className="pn-text">没有更多了</span></span>}
                {siblings.next
                  ? <Link to={`/post/${siblings.next.id}`} className="post-nav-item next"><span className="pn-label">下一条 <Icon name="back" size={14} style={{ transform: 'rotate(180deg)' }} /></span><span className="pn-text">{siblings.next.content}</span></Link>
                  : <span className="post-nav-item next is-off"><span className="pn-label">下一条</span><span className="pn-text">没有更多了</span></span>}
              </div>
            )}
          </>
        )}
    </Shell>
  );
}
