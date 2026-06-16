import { useState, useEffect } from 'react';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import { Loading, Empty } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { fmtNum, timeAgo } from '../lib/format';

const CAT = { title: '头衔', frame: '头像框', item: '道具', physical: '实物周边' };
const CAT_STYLE = {
  item: { color: '#2b54f0', icon: 'gift' },
  title: { color: '#d99e1f', icon: 'shield' },
  frame: { color: '#7c3aed', icon: 'image' },
  physical: { color: '#0e9f6e', icon: 'shop' },
};
// Map each virtual good to a real SVG icon (name-based — robust to emoji encoding),
// falling back to its category icon. Replaces the seeded emoji glyphs (anti-slop).
function productIcon(p) {
  const n = p.name || '';
  if (n.includes('改名')) return 'edit';
  if (n.includes('置顶')) return 'pin';
  if (n.includes('彩虹')) return 'palette';
  if (n.includes('夜猫')) return 'moon';
  if (n.includes('元老')) return 'shield';
  if (n.includes('锦鲤')) return 'fire';
  if (n.includes('贴纸')) return 'gift';
  if (n.includes('杯')) return 'shop';
  return CAT_STYLE[p.category]?.icon || 'gift';
}
function MallIcon({ p, size = 52 }) {
  const color = (CAT_STYLE[p.category] || {}).color || 'var(--brand)';
  return (
    <div className="mall-ico" style={{ width: size, height: size, borderRadius: size > 46 ? 14 : 12, '--mc': color }}>
      <Icon name={productIcon(p)} size={size > 46 ? 26 : 20} style={{ color }} />
    </div>
  );
}

export default function Mall() {
  const { user, setAuthOpen, patchUser } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('shop');

  const load = async () => {
    const [p, o] = await Promise.all([
      api.get('/mall/products'),
      user ? api.get('/mall/orders') : Promise.resolve({ data: { orders: [] } }),
    ]);
    setProducts(p.data.products); setOrders(o.data.orders);
  };
  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [user?.id]);

  const redeem = async (p) => {
    if (!user) return setAuthOpen(true);
    if (!confirm(`确定用 ${p.price} 积分兑换「${p.name}」吗?`)) return;
    try {
      const { data } = await api.post(`/mall/products/${p.id}/redeem`);
      patchUser(data.user);
      toast.ok('兑换成功 🎉');
      load();
    } catch (e) { toast.err(e.message); }
  };

  const right = (
    <div className="card widget">
      <div className="widget-title" style={{ marginBottom: 10 }}><Icon name="coin" size={16} className="tk" /> 我的积分</div>
      <div style={{ fontSize: 34, fontWeight: 800, fontFamily: 'var(--font-num)', color: 'var(--gold-deep)' }}>{fmtNum(user?.points || 0)}</div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>发帖、评论、被点赞、每日签到都能赚积分</div>
    </div>
  );

  return (
    <Shell right={user ? right : undefined}>
      <div className="card section-head">
        <h2 className="row gap-8"><Icon name="shop" size={19} style={{ color: 'var(--gold)' }} /> 积分商城</h2>
        {user && <div className="row gap-6 num" style={{ fontWeight: 700, color: 'var(--gold-deep)' }}><Icon name="coin" size={16} /> {fmtNum(user.points)}</div>}
      </div>

      <div className="card feed-tabs">
        <button className={`feed-tab${tab === 'shop' ? ' active' : ''}`} onClick={() => setTab('shop')}>商品</button>
        <button className={`feed-tab${tab === 'orders' ? ' active' : ''}`} onClick={() => setTab('orders')}>我的兑换 {orders.length > 0 && `(${orders.length})`}</button>
      </div>

      {loading ? <Loading /> : tab === 'shop' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--gap)' }}>
          {products.map((p) => (
            <div className="card" key={p.id} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <MallIcon p={p} size={52} />
                <span className="badge" style={{ background: `color-mix(in srgb, ${(CAT_STYLE[p.category]||{}).color || 'var(--brand)'} 13%, transparent)`, color: (CAT_STYLE[p.category]||{}).color || 'var(--brand-strong)' }}>{CAT[p.category]}</span>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{p.name}</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>{p.description}</div>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 'auto' }}>
                <div className="row gap-4 num" style={{ fontWeight: 800, color: 'var(--gold-deep)' }}>
                  <Icon name="coin" size={16} /> {fmtNum(p.price)}
                </div>
                <button
                  className={`btn btn-sm ${p.owned && p.category !== 'item' ? 'btn-ghost' : p.soldOut ? 'btn-ghost' : 'btn-primary'}`}
                  disabled={p.soldOut || (p.owned && p.category !== 'item')}
                  onClick={() => redeem(p)}>
                  {p.owned && p.category !== 'item' ? '已拥有' : p.soldOut ? '已售罄' : '兑换'}
                </button>
              </div>
              {p.stock >= 0 && <div className="faint" style={{ fontSize: 11 }}>限量 {p.stock} · 已兑 {p.sold}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {!user ? <Empty icon="🔒" text="登录后查看兑换记录" />
            : orders.length === 0 ? <Empty icon="🛍️" text="还没有兑换记录,去逛逛吧" />
            : orders.map((o, i) => (
              <div key={o.id}>
                {i > 0 && <div className="divider" />}
                <div className="row gap-12" style={{ padding: '14px 18px' }}>
                  <MallIcon p={o} size={42} />
                  <div className="grow"><div style={{ fontWeight: 700 }}>{o.name}</div><div className="faint" style={{ fontSize: 12 }}>{timeAgo(o.created_at)}</div></div>
                  <div className="num" style={{ color: 'var(--gold-deep)', fontWeight: 700 }}>-{o.price}</div>
                </div>
              </div>
            ))}
        </div>
      )}
    </Shell>
  );
}
