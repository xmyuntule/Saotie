import { useMemo, useState } from 'react';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import { BrandMark, BrandName } from '../components/Navbar';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { useToast } from '../context/ToastContext';

const MAX_CONTENT = 1000;

function cleanText(raw?: string | null, max = 240) {
  return (raw || '')
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max);
}

function safeHttpUrl(raw?: string | null) {
  try {
    const url = new URL((raw || '').trim());
    return /^https?:$/.test(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function imageParams(params: URLSearchParams) {
  const urls = [...params.getAll('image'), ...params.getAll('images')]
    .flatMap((item) => item.split(','))
    .map((item) => safeHttpUrl(item))
    .filter(Boolean);
  return [...new Set(urls)].slice(0, 9);
}

function defaultContent(typeLabel: string, title: string, summary: string, url: string) {
  return [
    `分享${typeLabel}：${title || '值得一看'}`,
    summary,
    `[查看详情](${url})`,
  ].filter(Boolean).join('\n\n').slice(0, MAX_CONTENT);
}

function notifyHost(type: 'success' | 'close', payload: Record<string, unknown> = {}) {
  const msg = { type: `saotie-share:${type}`, ...payload };
  try { window.parent?.postMessage(msg, '*'); } catch {}
  try { window.opener?.postMessage(msg, '*'); } catch {}
}

export default function SharePage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const site = useSite();
  const toast = useToast();
  const { user, login } = useAuth();
  const sourceUrl = safeHttpUrl(params.get('url') || document.referrer);
  const title = cleanText(params.get('title') || document.title, 120);
  const summary = cleanText(params.get('summary') || params.get('description'), 180);
  const typeLabel = cleanText(params.get('type') || '文章', 20);
  const images = useMemo(() => imageParams(params), [params]);
  const [content, setContent] = useState(() => sourceUrl ? defaultContent(typeLabel, title, summary, sourceUrl) : '');
  const [form, setForm] = useState({ username: '', password: '' });
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captcha, setCaptcha] = useState<{ required: boolean; token?: string; image?: string }>({ required: false });
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [published, setPublished] = useState<any>(null);
  const embedded = params.get('embedded') === '1';

  const media = images.map((url) => ({ type: 'image', url }));
  const remain = Math.max(0, MAX_CONTENT - content.length);

  const loadLoginCaptcha = async () => {
    setCaptchaLoading(true);
    try {
      const { data } = await api.get('/auth/login-captcha');
      setCaptcha(data || { required: false });
      setCaptchaAnswer('');
    } catch {
      setCaptcha({ required: false });
    } finally {
      setCaptchaLoading(false);
    }
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoginBusy(true);
    try {
      const u = await login(form.username.trim(), form.password, {
        captchaToken: captcha.required ? captcha.token : undefined,
        captchaAnswer: captcha.required ? captchaAnswer.trim() : undefined,
      });
      toast.ok(`欢迎回来，${u.nickname}`);
    } catch (e: any) {
      setErr(e.message);
      if (captcha.required || String(e.message || '').includes('验证码')) loadLoginCaptcha();
    } finally {
      setLoginBusy(false);
    }
  };

  const publish = async () => {
    if (!sourceUrl) return setErr('分享链接无效');
    if (!user) {
      setErr('请先登录后发布动态');
      return;
    }
    if (!content.trim()) return setErr('动态内容不能为空');
    setErr('');
    setBusy(true);
    try {
      const device = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? '手机端' : '电脑端';
      const { data } = await api.post('/posts', {
        content: content.trim(),
        media,
        mediaType: media.length ? 'image' : 'text',
        visibility: 'public',
        device,
        localizeExternalImages: true,
      });
      setPublished(data.post);
      notifyHost('success', { postId: data.post?.id, url: `${window.location.origin}/post/${data.post?.id}` });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    notifyHost('close');
    if (window.opener) window.close();
  };

  return (
    <div className={`share-page${embedded ? ' embedded' : ''}`}>
      <main className="share-card">
        <button className="share-close" type="button" onClick={close} aria-label="关闭"><Icon name="close" size={19} /></button>
        <div className="share-brand">
          <BrandMark size={36} logo={site.logo} name={site.name} />
          <BrandName name={site.name} />
        </div>

        {published ? (
          <div className="share-done">
            <span className="share-done-ico"><Icon name="check" size={30} /></span>
            <h1>已分享到动态</h1>
            <p>内容已发布到你的 {site.name || 'SaotieSNS'} 动态。</p>
            <div className="row gap-8" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <a className="btn btn-primary" href={`/post/${published.id}`} target="_blank" rel="noreferrer">查看动态</a>
              <button className="btn btn-ghost" type="button" onClick={close}>关闭</button>
            </div>
          </div>
        ) : (
          <>
            <div className="share-head">
              <h1>发布动态</h1>
              <p>{sourceUrl ? '编辑后发布到你的动态，好友可点击查看详情。' : '分享链接无效，请返回来源页面重新分享。'}</p>
            </div>

            <section className="share-editor">
              <div className="share-user-line">
                {user ? <Avatar user={user} size={44} showV /> : <span className="share-user-placeholder"><Icon name="user" size={22} /></span>}
                <div className="grow">
                  <div className="share-user-name">{user ? user.nickname : '登录后发布到 Saotie 动态'}</div>
                  <div className="faint" style={{ fontSize: 12.5 }}>{sourceUrl || '缺少来源链接'}</div>
                </div>
              </div>

              <textarea
                className="share-textarea"
                value={content}
                maxLength={MAX_CONTENT}
                onChange={(e) => setContent(e.target.value)}
                placeholder="分享你的新鲜事...（可 @好友、加 #话题#）"
              />

              {media.length > 0 && (
                <div className="share-image-strip">
                  {media.map((m) => <img key={m.url} src={m.url} alt="" loading="lazy" />)}
                </div>
              )}

              <div className="share-tools">
                <span title="图片"><Icon name="image" size={19} /></span>
                <span title="视频"><Icon name="video" size={19} /></span>
                <span title="链接"><Icon name="link" size={19} /></span>
                <span title="投票"><Icon name="trend" size={19} /></span>
                <span title="表情"><Icon name="smile" size={19} /></span>
                <span title="定位"><Icon name="location" size={19} /></span>
              </div>

              {err && <div className="form-err">{err}</div>}
              <div className="share-publish-row">
                <button className="btn btn-ghost" type="button" disabled>公开</button>
                <span className="faint num">{remain}/{MAX_CONTENT}</span>
                <button className="btn btn-primary btn-lg" type="button" onClick={publish} disabled={busy || !sourceUrl || !content.trim()}>
                  {busy ? '发布中...' : '发布'}
                </button>
              </div>
            </section>

            {!user && (
              <form className="share-login" onSubmit={doLogin}>
                <div className="share-login-title">登录后发布</div>
                <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="用户名" autoComplete="username" />
                <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="密码" autoComplete="current-password" />
                {captcha.required && (
                  <div className="auth-captcha-row">
                    <input value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} placeholder="输入图中字符" maxLength={12} autoComplete="off" />
                    {captcha.image && (
                      <button type="button" className="auth-captcha-image" onClick={loadLoginCaptcha} disabled={captchaLoading} title="点击刷新验证码">
                        <img src={captcha.image} alt="图形验证码，点击刷新" />
                      </button>
                    )}
                  </div>
                )}
                <button className="btn btn-primary btn-block" type="submit" disabled={loginBusy || !form.username.trim() || !form.password}>
                  {loginBusy ? '登录中...' : '登录'}
                </button>
                <a className="btn btn-ghost btn-block" href="/" target="_blank" rel="noreferrer">注册新账号</a>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}
