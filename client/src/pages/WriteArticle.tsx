import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import type { Article } from '../types';
import { CAT_META } from './Articles';

const CATEGORIES = ['综合', '技术', '设计', '产品', '生活', '观点'];

export default function WriteArticle() {
  const { user, setAuthOpen } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('综合');
  const [cover, setCover] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <Shell right={false}>
        <div className="ui-card" style={{ padding: 40, textAlign: 'center' }}>
          登录后即可发表专栏文章。
          <div><button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setAuthOpen(true)}>登录 / 注册</button></div>
        </div>
      </Shell>
    );
  }

  const canPublish = title.trim().length >= 2 && content.trim().length >= 10;

  const publish = async () => {
    if (!canPublish || busy) return;
    setBusy(true);
    try {
      const { data } = await api.post<{ article: Article }>('/articles', {
        title: title.trim(), category, cover: cover.trim(), summary: summary.trim(), content: content.trim(),
      });
      toast.ok('文章已发布');
      navigate(`/article/${data.article.id}`);
    } catch (err) { toast.err((err as Error).message); setBusy(false); }
  };

  return (
    <Shell right={false}>
      <div className="art-back-row">
        <Link to="/articles" className="art-back"><Icon name="back" size={16} /> 专栏</Link>
      </div>

      <div className="ui-card art-editor">
        <input className="art-ed-title" placeholder="标题" value={title} maxLength={60}
          onChange={(e) => setTitle(e.target.value)} />

        <div className="art-ed-cats">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className={`art-cat-chip${category === c ? ' on' : ''}`}
              onClick={() => setCategory(c)} style={{ '--cc': CAT_META[c]?.c || 'var(--brand)' } as React.CSSProperties}>
              <Icon name={CAT_META[c]?.icon || 'edit'} size={14} /> {c}
            </button>
          ))}
        </div>

        <label className="art-ed-field">
          <span className="art-ed-label"><Icon name="image" size={14} /> 封面图链接（选填）</span>
          <input className="inp" placeholder="https://… 留空将使用分类配色封面" value={cover} onChange={(e) => setCover(e.target.value)} />
        </label>

        <textarea className="art-ed-body" placeholder="开始写正文…支持 @提到 和 #话题#，空行分段。" value={content}
          onChange={(e) => setContent(e.target.value)} />

        <label className="art-ed-field">
          <span className="art-ed-label"><Icon name="edit" size={14} /> 摘要（选填，留空自动截取）</span>
          <input className="inp" placeholder="一句话概括这篇文章" value={summary} maxLength={120} onChange={(e) => setSummary(e.target.value)} />
        </label>

        <div className="art-ed-footer">
          <span className="art-ed-count">{content.length} 字</span>
          <div className="row gap-8">
            <Link to="/articles" className="btn btn-ghost">取消</Link>
            <button className="btn btn-primary" onClick={publish} disabled={!canPublish || busy}>
              <Icon name="send" size={15} /> {busy ? '发布中…' : '发布'}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
