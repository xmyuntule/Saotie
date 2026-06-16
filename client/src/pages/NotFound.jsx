import { Link } from 'react-router-dom';
import Shell from '../components/Shell';

export default function NotFound() {
  return (
    <Shell right={false}>
      <div className="ui-card">
        <div className="empty" style={{ padding: '72px 20px' }}>
          <div className="e-ico" style={{ fontSize: 56 }}>🧭</div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 12 }}>页面走丢了</div>
          <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>你访问的页面可能已被删除，或链接有误</div>
          <Link to="/" className="btn btn-primary btn-lg" style={{ marginTop: 22 }}>返回首页</Link>
        </div>
      </div>
    </Shell>
  );
}
