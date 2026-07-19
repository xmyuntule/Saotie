import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSite } from '../context/SiteContext';
import api from '../api/client';

interface AuthForm {
  username: string;
  password: string;
  nickname: string;
  inviteCode: string;
  captchaAnswer: string;
}

interface RegisterCaptcha {
  required: boolean;
  token?: string;
  image?: string;
  expiresIn?: number;
}

export default function AuthModal() {
  const { authOpen, setAuthOpen, login, register } = useAuth();
  const toast = useToast();
  const site = useSite();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState<AuthForm>({ username: '', password: '', nickname: '', inviteCode: '', captchaAnswer: '' });
  const [captcha, setCaptcha] = useState<RegisterCaptcha>({ required: false });
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // 邀请链接 ?invite=用户名 → 预填邀请码并默认切到注册
  useEffect(() => {
    if (!authOpen) return;
    try {
      const code = new URLSearchParams(window.location.search).get('invite');
      if (code) { setForm((f) => ({ ...f, inviteCode: code })); setMode('register'); }
    } catch { /* ignore */ }
  }, [authOpen]);

  const close = () => { setAuthOpen(false); setErr(''); };
  const set = (k: keyof AuthForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const loadCaptcha = async () => {
    setCaptchaLoading(true);
    try {
      const { data } = await api.get('/auth/register-captcha');
      setCaptcha(data || { required: false });
      setForm((f) => ({ ...f, captchaAnswer: '' }));
    } catch {
      setCaptcha({ required: false });
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    if (authOpen && mode === 'register') loadCaptcha();
  }, [authOpen, mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (mode === 'login') {
        const u = await login(form.username.trim(), form.password);
        toast.ok(`欢迎回来，${u.nickname}`);
      } else {
        const u = await register({
          username: form.username.trim(),
          password: form.password,
          nickname: form.nickname.trim(),
          inviteCode: form.inviteCode.trim() || undefined,
          captchaToken: captcha.required ? captcha.token : undefined,
          captchaAnswer: captcha.required ? form.captchaAnswer.trim() : undefined,
        });
        toast.ok(`注册成功，欢迎加入，${u.nickname}！`);
      }
    } catch (e: any) {
      setErr(e.message);
      if (mode === 'register' && captcha.required) loadCaptcha();
    }
    finally { setBusy(false); }
  };

  return (
    <Modal open={authOpen} onClose={close}>
      <div className="auth-hero">
        <h2>{mode === 'login' ? '欢迎回来 👋' : `加入 ${site.name || 'SaotieSNS'}`}</h2>
        <p>{mode === 'login' ? '登录后即可发动态、参与论坛、私信好友' : '注册一个账号，开启你的轻社交之旅'}</p>
      </div>
      <div className="modal-body">
        {err && <div className="form-err">{err}</div>}
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="field">
              <label>昵称（可选）</label>
              <input value={form.nickname} onChange={set('nickname')} placeholder="想让大家怎么称呼你？" maxLength={20} />
            </div>
          )}
          <div className="field">
            <label>用户名</label>
            <input value={form.username} onChange={set('username')} placeholder="字母、数字、下划线或中文" autoFocus />
          </div>
          <div className="field">
            <label>密码</label>
            <input type="password" value={form.password} onChange={set('password')} placeholder="至少 6 位" />
          </div>
          {mode === 'register' && (
            <div className="field">
              <label>邀请码（可选）</label>
              <input value={form.inviteCode} onChange={set('inviteCode')} placeholder="填邀请人用户名，双方得积分" maxLength={64} />
            </div>
          )}
          {mode === 'register' && captcha.required && (
            <div className="field">
              <label>图形验证码</label>
              <div className="auth-captcha-row">
                <input className="auth-captcha-plain-input" value={form.captchaAnswer} onChange={set('captchaAnswer')} placeholder="输入图中字符" maxLength={12} autoComplete="off" />
                {captcha.image && (
                  <button type="button" className="auth-captcha-image" onClick={loadCaptcha} disabled={captchaLoading} title="点击刷新验证码">
                    <img src={captcha.image} alt="图形验证码，点击刷新" />
                  </button>
                )}
              </div>
            </div>
          )}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>
        <div className="auth-switch">
          {mode === 'login' ? (
            <>还没有账号？<button onClick={() => { setMode('register'); setErr(''); }}>立即注册</button></>
          ) : (
            <>已有账号？<button onClick={() => { setMode('login'); setErr(''); }}>去登录</button></>
          )}
        </div>
      </div>
    </Modal>
  );
}
