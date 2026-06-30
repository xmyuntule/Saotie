import { Link, useNavigate } from 'react-router-dom';
import Shell from '../components/Shell';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <Shell right={false}>
      <div className="ui-card">
        <div className="empty" style={{ padding: '72px 20px' }}>
          <div className="e-ico" style={{ fontSize: 56 }}>🧭</div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 12 }}>页面走丢了</div>
          <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>你访问的页面可能已被删除，或链接有误</div>
          {/* 失效页面多由旧链接（如已删动态）进来：优先「返回上一页」更省事；无历史时只显示回首页 */}
          <div className="row gap-8" style={{ justifyContent: 'center', marginTop: 22, flexWrap: 'wrap' }}>
            {window.history.length > 1 && (
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate(-1)}>返回上一页</button>
            )}
            <Link to="/" className="btn btn-primary btn-lg">返回首页</Link>
          </div>
        </div>
      </div>
    </Shell>
  );
}
