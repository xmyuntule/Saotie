import { useState } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface AuthForm {
  username: string;
  password: string;
  nickname: string;
}

export default function AuthModal() {
  const { authOpen, setAuthOpen, login, register } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState<AuthForm>({ username: '', password: '', nickname: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => { setAuthOpen(false); setErr(''); };
  const set = (k: keyof AuthForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (mode === 'login') {
        const u = await login(form.username.trim(), form.password);
        toast.ok(`欢迎回来，${u.nickname}`);
      } else {
        const u = await register({ username: form.username.trim(), password: form.password, nickname: form.nickname.trim() });
        toast.ok(`注册成功，欢迎加入，${u.nickname}！`);
      }
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={authOpen} onClose={close}>
      <div className="auth-hero">
        <h2>{mode === 'login' ? '欢迎回来 👋' : '加入 HahaSNS'}</h2>
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
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? '请稍候…' : mode === 'login' ? '登 录' : '注 册'}
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
