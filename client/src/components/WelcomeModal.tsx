import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';

const FEATURES: [string, string, string][] = [
  ['🪶', '轻社交动态', '文字 / 图片 / 视频 / 音乐，支持付费、匿名、加密'],
  ['💬', '社区论坛', '版块讨论、内联看帖回帖、版主管理'],
  ['🎁', '积分体系', '签到赚积分，商城兑换头衔与装扮'],
];

export default function WelcomeModal() {
  const { setAuthOpen } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem('haha_welcomed') && !localStorage.getItem('haha_token')) {
        const t = setTimeout(() => setOpen(true), 700);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  const close = () => { try { localStorage.setItem('haha_welcomed', '1'); } catch {} setOpen(false); };

  return (
    <Modal open={open} onClose={close}>
      <div className="auth-hero">
        <h2>欢迎来到 HahaSNS 👋</h2>
        <p>轻社交 · 轻论坛 · 轻社区，连接有趣的人与内容</p>
      </div>
      <div className="modal-body">
        {FEATURES.map(([ic, t, d]) => (
          <div className="row gap-12" style={{ padding: '9px 0' }} key={t}>
            <div className="center" style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--surface-2)', fontSize: 22, flex: 'none' }}>{ic}</div>
            <div><div style={{ fontWeight: 700 }}>{t}</div><div className="muted" style={{ fontSize: 13 }}>{d}</div></div>
          </div>
        ))}
        <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 16 }} onClick={() => { close(); setAuthOpen(true); }}>注册 / 登录开始</button>
        <div className="muted" style={{ textAlign: 'center', fontSize: 12.5, marginTop: 10 }}>
          体验账号 admin / 123456 · <button onClick={close} style={{ color: 'var(--brand)', fontWeight: 600 }}>先随便逛逛 →</button>
        </div>
      </div>
    </Modal>
  );
}
