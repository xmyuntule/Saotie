import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { BrandMark, BrandName } from '../components/Navbar';
import { useSite } from '../context/SiteContext';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const site = useSite();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return setErr('新密码至少 6 位');
    if (password !== confirm) return setErr('两次输入的密码不一致');
    setBusy(true); setErr('');
    try { await api.post('/auth/reset-password', { token: params.get('token') || '', password }); toast.ok('密码已重置，请使用新密码登录'); nav('/'); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return <main className="auth-landing" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20 }}>
    <section className="auth-form-card" style={{ margin: 'auto' }}>
      <div className="auth-form-brand"><BrandMark size={34} logo={site.logo} name={site.name} /><BrandName name={site.name} /></div>
      <h1 className="auth-form-title">设置新密码</h1>
      <p className="muted" style={{ fontSize: 13.5, margin: '8px 0 20px' }}>重置链接仅能使用一次，有效期 30 分钟。</p>
      {err && <div className="form-err">{err}</div>}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input className="inp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="新密码，至少 6 位" autoFocus autoComplete="new-password" />
        <input className="inp" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次输入新密码" autoComplete="new-password" />
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? '保存中...' : '重置密码'}</button>
      </form>
      <div className="auth-switch"><Link to="/">返回登录</Link></div>
    </section>
  </main>;
}
