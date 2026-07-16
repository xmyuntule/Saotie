import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import { useSite } from '../context/SiteContext';
import { simplifyUrlLabel } from '../lib/format';

export default function ExternalRedirect() {
  const site = useSite();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const raw = params.get('url') || '';
  let target = '';
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') target = url.toString();
  } catch {
    target = '';
  }
  const close = () => {
    if (window.history.length > 1) nav(-1);
    else nav('/');
  };
  const go = () => {
    if (target) window.location.assign(target);
  };
  return (
    <Shell layout="narrow">
      <div className="ui-card" style={{ padding: 24 }}>
        <div className="row gap-10" style={{ alignItems: 'center', marginBottom: 12 }}>
          <span className="stat-ic" style={{ color: 'var(--gold-deep)', background: 'color-mix(in srgb, var(--gold) 16%, transparent)' }}>
            <Icon name="shield" size={18} />
          </span>
          <h1 style={{ fontSize: 20 }}>即将打开站外链接</h1>
        </div>
        {target ? (
          <>
            <p className="muted" style={{ lineHeight: 1.7 }}>
              您即将打开当前非{site.name || 'SaotieSNS'}站内链接，无法确保打开的链接页面安全性。
            </p>
            <div className="ui-card" style={{ padding: 12, marginTop: 14, background: 'var(--surface-2)', wordBreak: 'break-all' }}>
              {simplifyUrlLabel(target)}
            </div>
            <div className="row gap-10" style={{ justifyContent: 'flex-end', marginTop: 18, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={close}>关闭返回</button>
              <button className="btn btn-primary" onClick={go}>继续前往</button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">链接地址无效，已阻止跳转。</p>
            <div className="row gap-10" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn btn-primary" onClick={close}>返回</button>
              <Link className="btn btn-ghost" to="/">回到首页</Link>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
