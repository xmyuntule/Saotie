import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import { Badges } from '../components/Identity';
import { Empty, Loading } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLayout } from '../context/SiteContext';
import api from '../api/client';

type CertFile = {
  name: string;
  type: string;
  mimetype: string;
  size: number;
  preview?: string;
};

type CertApplication = {
  id: number;
  type: 'personal' | 'enterprise';
  label: string;
  realName: string;
  contact: string;
  companyName: string;
  companyInfo: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  reviewNote: string;
  createdAt: string;
  reviewedAt?: string | null;
  proofFiles: CertFile[];
  licenseFiles: CertFile[];
};

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '审核中', color: 'var(--gold)' },
  approved: { label: '已通过', color: 'var(--good)' },
  rejected: { label: '未通过', color: 'var(--like)' },
  revoked: { label: '已撤销', color: 'var(--muted)' },
};

function fileSize(size = 0) {
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function Certification() {
  const { user, loading, setAuthOpen, patchUser } = useAuth();
  const layout = useLayout('settings', 'narrow');
  const toast = useToast();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const [application, setApplication] = useState<CertApplication | null>(null);
  const [type, setType] = useState<'personal' | 'enterprise'>('personal');
  const [form, setForm] = useState({
    label: '',
    realName: '',
    contact: '',
    companyName: '',
    companyInfo: '',
  });
  const [files, setFiles] = useState<File[]>([]);

  const load = async () => {
    if (!user) return;
    setLoaded(false);
    try {
      const { data } = await api.get('/certifications/me');
      setLabels(data.labels || []);
      setApplication(data.application || null);
      if (data.user) patchUser(data.user);
      setForm((f) => ({ ...f, label: data.labels?.[0] || f.label || '技术人员' }));
    } catch (e: any) {
      toast.err(e.message);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const status = application ? STATUS[application.status] || STATUS.pending : null;
  const canSubmit = !application || application.status === 'rejected' || application.status === 'revoked';
  const selectedLabel = useMemo(() => form.label || labels[0] || '技术人员', [form.label, labels]);

  if (loading) return <Shell layout={layout}><Loading /></Shell>;
  if (!user) {
    setAuthOpen(true);
    return <Shell layout={layout}><div className="ui-card"><Empty icon="认证" text="登录后提交认证申请" /></div></Shell>;
  }

  const submit = async () => {
    if (!canSubmit) return;
    const fd = new FormData();
    fd.append('type', type);
    fd.append('contact', form.contact.trim());
    if (type === 'personal') {
      fd.append('label', selectedLabel);
      fd.append('realName', form.realName.trim());
    } else {
      fd.append('companyName', form.companyName.trim());
      fd.append('companyInfo', form.companyInfo.trim());
    }
    files.forEach((file) => fd.append('files', file));
    setBusy(true);
    try {
      await api.post('/certifications/me', fd);
      toast.ok('认证申请已提交，请等待管理员审核');
      setFiles([]);
      await load();
    } catch (e: any) {
      toast.err(e.message);
    } finally {
      setBusy(false);
    }
  };

  const currentFiles = application?.type === 'enterprise' ? application.licenseFiles : application?.proofFiles;

  return (
    <Shell layout={layout}>
      <div className="ui-card page-title">
        <button className="back-btn" onClick={() => nav(-1)} aria-label="返回"><Icon name="back" size={20} /></button>
        身份认证
      </div>

      <div className="ui-card" style={{ padding: 20 }}>
        <div className="row gap-12" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div className="row gap-8" style={{ fontWeight: 850, fontSize: 18 }}>
              <Icon name="shield" size={19} style={{ color: 'var(--brand)' }} />
              认证中心
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.7 }}>
              个人认证展示黄标，企业认证展示红标。认证材料仅本人和管理员可见。
            </div>
          </div>
          <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
            <span className="ui-badge">当前</span>
            <Badges user={user} />
          </div>
        </div>
      </div>

      {!loaded ? <Loading /> : (
        <>
          {application && (
            <div className="ui-card" style={{ padding: 18, marginTop: 'var(--gap)' }}>
              <div className="row gap-10" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>最近一次申请</div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                    #{application.id} · {application.type === 'enterprise' ? '企业认证' : '个人认证'}
                    {application.label ? ` · ${application.label}` : ''}
                  </div>
                </div>
                {status && <span className="pill" style={{ color: status.color }}>{status.label}</span>}
              </div>
              {application.reviewNote && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'var(--surface-2)', color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.65 }}>
                  审核备注：{application.reviewNote}
                </div>
              )}
              {currentFiles && currentFiles.length > 0 && (
                <div className="row gap-10" style={{ flexWrap: 'wrap', marginTop: 14 }}>
                  {currentFiles.map((file, i) => (
                    <div key={`${file.name}-${i}`} style={{ width: 118 }}>
                      {file.preview ? <img src={file.preview} alt={file.name} style={{ width: 118, height: 82, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} /> : <div className="ui-card center" style={{ width: 118, height: 82 }}><Icon name="image" size={22} /></div>}
                      <div className="muted nowrap" style={{ fontSize: 11.5, marginTop: 6 }}>{file.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="ui-card" style={{ padding: 20, marginTop: 'var(--gap)' }}>
            <div className="row gap-8" style={{ marginBottom: 16 }}>
              <button className={`btn ${type === 'personal' ? 'btn-primary' : 'btn-outline'}`} disabled={!canSubmit} onClick={() => { setType('personal'); setFiles([]); }}>个人认证</button>
              <button className={`btn ${type === 'enterprise' ? 'btn-primary' : 'btn-outline'}`} disabled={!canSubmit} onClick={() => { setType('enterprise'); setFiles([]); }}>企业认证</button>
            </div>

            {!canSubmit ? (
              <div className="muted" style={{ lineHeight: 1.7 }}>
                {application?.status === 'pending' ? '当前申请正在审核中，请勿重复提交。' : '账号已通过认证，如需变更认证类型或资料，请联系管理员处理。'}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {type === 'personal' ? (
                  <>
                    <label className="sec-field">
                      <span className="sec-label">认证标签</span>
                      <select className="inp" value={selectedLabel} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}>
                        {(labels.length ? labels : ['技术人员', '内容创作者', '其他']).map((label) => <option key={label} value={label}>{label}</option>)}
                      </select>
                    </label>
                    <label className="sec-field">
                      <span className="sec-label">真实姓名</span>
                      <input className="inp" value={form.realName} maxLength={64} onChange={(e) => setForm((f) => ({ ...f, realName: e.target.value }))} placeholder="用于管理员审核，不公开展示" />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="sec-field">
                      <span className="sec-label">企业名称</span>
                      <input className="inp" value={form.companyName} maxLength={128} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} placeholder="认证通过后作为企业红标展示" />
                    </label>
                    <label className="sec-field">
                      <span className="sec-label">企业信息 / 统一社会信用代码</span>
                      <textarea className="inp" value={form.companyInfo} maxLength={500} rows={3} onChange={(e) => setForm((f) => ({ ...f, companyInfo: e.target.value }))} placeholder="填写企业简介、官网、统一社会信用代码等辅助审核信息" />
                    </label>
                  </>
                )}
                <label className="sec-field">
                  <span className="sec-label">联系方式</span>
                  <input className="inp" value={form.contact} maxLength={64} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} placeholder="手机号、邮箱或微信，用于审核沟通" />
                </label>
                <label className="sec-field">
                  <span className="sec-label">{type === 'personal' ? '证明图片（1-3张）' : '营业执照图片（1张）'}</span>
                  <input className="inp" type="file" accept="image/*" multiple={type === 'personal'} onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                </label>
                {files.length > 0 && (
                  <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
                    {files.map((file) => <span key={`${file.name}-${file.size}`} className="pill">{file.name}{file.size ? ` · ${fileSize(file.size)}` : ''}</span>)}
                  </div>
                )}
                <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={submit}>
                  {busy ? '提交中...' : '提交认证申请'}
                </button>
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
                  建议上传其他平台认证截图、个人主页截图或营业执照清晰照片。单张图片最大 8MB，系统会自动压缩为私有审核材料。
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}
