import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input, Tabs, Tab } from '../components/heroui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSite } from '../context/SiteContext';
import { BrandMark, BrandName } from '../components/Navbar';
import SiteFooter from '../components/SiteFooter';
import Icon from '../components/Icon';
import api from '../api/client';

const FEATURES = [
  ['edit', '轻社交动态', '文字 / 图片 / 视频 / 音乐，随手记录'],
  ['forum', '社区论坛', '版块讨论、内联看帖、版主管理'],
  ['coin', '积分体系', '签到赚积分，商城兑换专属装扮'],
];

function lines(text: string) {
  return text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

function heroFeatures(raw = '') {
  const rows = lines(raw);
  if (!rows.length) return FEATURES;
  return rows.slice(0, 5).map((row, i) => {
    const parts = row.split(/[|｜]/).map((s) => s.trim());
    const fallback = FEATURES[i % FEATURES.length];
    return [fallback[0], parts[0] || fallback[1], parts[1] || fallback[2]];
  });
}

export default function AuthLanding() {
  const { login, register } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', nickname: '', captchaAnswer: '' });
  const [captcha, setCaptcha] = useState<{ required: boolean; token?: string; image?: string }>({ required: false });
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const site = useSite();
  const hero = site.authHero || {};
  const heroTitle = hero.title?.trim() || '连接有趣的人\n与值得分享的内容';
  const heroSubtitle = hero.subtitle?.trim() || site.slogan || '轻社交社区';
  const features = heroFeatures(hero.points);
  const bgUrl = hero.bgUrl?.trim() || '';
  const bgType = hero.bgType === 'video' ? 'video' : 'image';
  const set = (k: string) => (v: any) => setForm((f) => ({ ...f, [k]: v }));

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
    if (mode === 'register') loadCaptcha();
  }, [mode]);

  const submit = async (e: any) => {
    e?.preventDefault();
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
    <div className="auth-landing">
      <div className="auth-landing-hero">
        {bgUrl && (
          bgType === 'video'
            ? <video className="auth-bg-media" src={bgUrl} autoPlay muted loop playsInline />
            : <img className="auth-bg-media" src={bgUrl} alt="" />
        )}
        <div className="auth-hero-inner">
          <div className="row gap-8" style={{ marginBottom: 26 }}>
            <BrandMark size={40} logo={site.logo} name={site.name} />
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.02em' }}>{site.name}</span>
          </div>
          <h1 className="auth-hero-title">{lines(heroTitle).map((line) => <span key={line}>{line}</span>)}</h1>
          <p className="auth-hero-sub">{heroSubtitle}</p>
          <div className="auth-hero-features">
            {features.map(([ic, t, d]) => (
              <div className="row gap-12" key={t} style={{ marginTop: 16 }}>
                <div className="auth-feat-ico"><Icon name={ic} size={22} /></div>
                <div><div style={{ fontWeight: 700 }}>{t}</div><div style={{ opacity: .82, fontSize: 13 }}>{d}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-landing-form">
        <div className="auth-mobile-intro">
          <BrandMark size={46} logo={site.logo} name={site.name} />
          <h2 className="auth-mi-title">{lines(heroTitle).map((line) => <span key={line}>{line}</span>)}</h2>
          <p className="auth-mi-sub">{heroSubtitle}</p>
        </div>
        <div className="auth-form-card">
          <div className="auth-form-brand"><BrandMark size={34} logo={site.logo} name={site.name} /><BrandName name={site.name} /></div>

          <Tabs
            aria-label="登录或注册"
            selectedKey={mode}
            onSelectionChange={(k: any) => { setMode(k); setErr(''); }}
            color="primary" radius="lg" fullWidth size="lg"
            classNames={{ base: 'mb-4', tabList: 'bg-default-100' }}
          >
            <Tab key="login" title="登录" />
            <Tab key="register" title="注册" />
          </Tabs>

          <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>
            {mode === 'login' ? '登录后即可浏览动态、参与社区' : '注册一个账号，开启你的轻社交之旅'}
          </p>
          {err && <div className="form-err">{err}</div>}

          <form onSubmit={submit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <Input label="昵称（可选）" labelPlacement="outside" variant="bordered" radius="md"
                value={form.nickname} onValueChange={set('nickname')} maxLength={20} placeholder="想让大家怎么称呼你？" />
            )}
            <Input label="用户名" labelPlacement="outside" variant="bordered" radius="md" autoFocus
              value={form.username} onValueChange={set('username')} placeholder="字母、数字、下划线或中文" />
            <Input label="密码" labelPlacement="outside" variant="bordered" radius="md"
              type={showPw ? 'text' : 'password'} value={form.password} onValueChange={set('password')} placeholder="至少 6 位"
              endContent={
                <button type="button" className="text-default-400 hover:text-default-600" onClick={() => setShowPw((s) => !s)} aria-label="显示密码">
                  <Icon name="eye" size={18} />
                </button>
              } />
            {mode === 'register' && captcha.required && (
              <div>
                <Input label="图形验证码" labelPlacement="outside" variant="bordered" radius="md"
                  value={form.captchaAnswer} onValueChange={set('captchaAnswer')} placeholder="输入图中字符" maxLength={12} />
                {captcha.image && (
                  <button type="button" onClick={loadCaptcha} disabled={captchaLoading} title="点击刷新验证码" style={{ marginTop: 8, padding: 0, border: 0, background: 'transparent', cursor: captchaLoading ? 'default' : 'pointer' }}>
                    <img src={captcha.image} alt="图形验证码" width={170} height={58} style={{ display: 'block', borderRadius: 12 }} />
                  </button>
                )}
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy} style={{ marginTop: 4, fontWeight: 700 }}>
              {busy ? <span className="ui-spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor: '#fff' }} /> : (mode === 'login' ? '登录' : '注册')}
            </button>
          </form>
        </div>
        <div className="faint" style={{ fontSize: 12, textAlign: 'center', marginTop: 18 }}>
          <Link to="/about" className="auth-about-link">了解功能</Link>
          <SiteFooter links={false} className="auth-footer" />
        </div>
      </div>
    </div>
  );
}
