import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import Comments from '../components/Comments';
import MediaGrid from '../components/MediaGrid';
import Modal from '../components/Modal';
import { UserName } from '../components/Identity';
import { Loading, Empty } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { timeAgo, fmtNum } from '../lib/format';

export default function ThreadDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, setAuthOpen } = useAuth();
  const toast = useToast();
  const [t, setT] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ title: '', content: '' });

  useEffect(() => {
    setLoading(true);
    api.get(`/forum/threads/${id}`).then(({ data }) => setT(data.thread)).catch(() => setT(null)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Shell right={false}><Loading /></Shell>;
  if (!t) return <Shell right={false}><div className="card"><Empty icon="🔍" text="帖子不存在或已删除" /></div></Shell>;

  const like = async () => {
    if (!user) return setAuthOpen(true);
    try {
      const { data } = await api.post(`/forum/threads/${t.id}/like`);
      setT((x) => ({ ...x, liked: data.liked, likeCount: data.likeCount }));
    } catch (e) { toast.err(e.message); }
  };

  const moderate = async (action) => {
    if (action === 'delete' && !confirm('确定删除该帖？')) return;
    try {
      const { data } = await api.post(`/forum/threads/${t.id}/moderate`, { action });
      if (data.deleted) { toast.ok('已删除'); nav(`/forum/${t.board.slug}`); return; }
      setT((x) => ({ ...x, pinned: data.pinned ?? x.pinned, elite: data.elite ?? x.elite, locked: data.locked ?? x.locked }));
      toast.ok('操作成功');
    } catch (e) { toast.err(e.message); }
  };

  const isOwner = user && t.author?.id === user.id;
  const openEdit = () => { setEdit({ title: t.title, content: t.content }); setEditOpen(true); setMenuOpen(false); };
  const saveEdit = async () => {
    try { const { data } = await api.put(`/forum/threads/${t.id}`, edit); setT((x) => ({ ...x, ...data.thread })); setEditOpen(false); toast.ok('已更新'); }
    catch (e) { toast.err(e.message); }
  };
  const report = async () => {
    setMenuOpen(false);
    if (!user) return setAuthOpen(true);
    const reason = prompt('举报原因（选填）：');
    if (reason === null) return;
    try { await api.post('/reports', { targetType: 'thread', targetId: t.id, reason }); toast.ok('举报已提交，感谢反馈'); }
    catch (e) { toast.err(e.message); }
  };

  return (
    <Shell right={false}>
      <div className="card">
        <div className="page-title" style={{ paddingBottom: 0 }}>
          <button className="back-btn" onClick={() => nav(-1)} aria-label="返回"><Icon name="back" size={20} /></button>
          <Link to={`/forum/${t.board?.slug}`} className="thread-board-tag" style={{ fontSize: 14 }}>{t.board?.icon} {t.board?.name}</Link>
        </div>
        <div className="thread-detail" style={{ paddingTop: 12 }}>
          <h1>
            {t.pinned && <span className="badge badge-pin" style={{ marginRight: 6, verticalAlign: 'middle' }}>置顶</span>}
            {t.elite && <span className="badge badge-elite" style={{ marginRight: 6, verticalAlign: 'middle' }}>精华</span>}
            {t.title}
          </h1>
          <div className="row gap-12" style={{ marginBottom: 16 }}>
            <Avatar user={t.author} size={42} showV />
            <div className="grow">
              <UserName user={t.author} />
              <div className="umeta"><span>{timeAgo(t.createdAt)}</span><span className="dot"><Icon name="eye" size={12} style={{ verticalAlign: -2 }} /> {fmtNum(t.views)} 浏览</span></div>
            </div>
            {t.canModerate && (
              <div className="row gap-4 hide-mobile">
                <button className="btn btn-ghost btn-sm" onClick={() => moderate('pin')}>{t.pinned ? '取消置顶' : '置顶'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => moderate('elite')}>{t.elite ? '取消精华' : '加精'}</button>
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <button className="post-menu" onClick={() => setMenuOpen((m) => !m)} aria-label="更多操作"><Icon name="more" size={18} /></button>
              {menuOpen && (
                <div className="card menu-pop" onMouseLeave={() => setMenuOpen(false)}>
                  {isOwner && <button className="menu-item" onClick={openEdit}><Icon name="edit" size={16} /> 编辑</button>}
                  {!isOwner && <button className="menu-item" onClick={report}><Icon name="flag" size={16} /> 举报</button>}
                  {(isOwner || t.canModerate) && <button className="menu-item danger" onClick={() => { setMenuOpen(false); moderate('delete'); }}><Icon name="close" size={16} /> 删除</button>}
                </div>
              )}
            </div>
          </div>
          <div className="thread-content">{t.content}</div>
          {t.media?.length > 0 && <MediaGrid media={t.media} />}

          <div className="row gap-8" style={{ marginTop: 22 }}>
            <button className={`btn ${t.liked ? 'btn-primary' : 'btn-outline'}`} onClick={like}>
              <Icon name="heart" size={16} fill={t.liked} /> 赞 {t.likeCount > 0 ? fmtNum(t.likeCount) : ''}
            </button>
            <div className="muted" style={{ fontSize: 13 }}>{fmtNum(t.replyCount)} 条回复</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-head" style={{ paddingBottom: 0 }}><h2 style={{ fontSize: 16 }}>全部回复</h2></div>
        <Comments threadId={t.id} onCountChange={() => setT((x) => ({ ...x, replyCount: x.replyCount + 1 }))} />
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} large>
        <div className="modal-head"><div className="modal-title">编辑帖子</div></div>
        <div className="modal-body">
          <div className="field"><label>标题</label><input value={edit.title} onChange={(e) => setEdit((s) => ({ ...s, title: e.target.value }))} maxLength={60} /></div>
          <div className="field"><label>正文</label><textarea value={edit.content} onChange={(e) => setEdit((s) => ({ ...s, content: e.target.value }))} style={{ minHeight: 160 }} /></div>
          <button className="btn btn-primary btn-lg btn-block" onClick={saveEdit} disabled={!edit.title.trim() || !edit.content.trim()}>保存修改</button>
        </div>
      </Modal>
    </Shell>
  );
}
