import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Card, CardBody, Tabs, Tab, Button, Chip,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Input, Textarea, Select, SelectItem, useDisclosure,
} from '../components/heroui';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import Avatar from '../components/Avatar';
import { Empty, QaListSkeleton } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { fmtNum, timeAgo } from '../lib/format';
import { onCtrlEnter } from '../lib/kbd';

const CATS = ['综合', '技术', '生活', '情感', '职场', '校园', '数码'];
const STATUS = [{ k: 'all', t: '全部' }, { k: 'open', t: '待解决' }, { k: 'solved', t: '已解决' }];

function QuestionRow({ q }: { q: any }) {
  return (
    <Link to={`/qa/${q.id}`} className="qa-row">
      <div className="qa-stats">
        <div className={`qa-stat${q.answerCount > 0 ? ' has' : ''}`}>
          <b>{fmtNum(q.answerCount)}</b><span>回答</span>
        </div>
      </div>
      <div className="qa-main">
        <div className="qa-title-row">
          {q.status === 'solved' && <span className="qa-solved"><Icon name="check" size={12} /> 已解决</span>}
          <span className="qa-title">{q.title}</span>
        </div>
        {q.excerpt && <p className="qa-excerpt">{q.excerpt}</p>}
        <div className="qa-meta">
          <Chip size="sm" variant="flat" className="shrink-0">{q.category}</Chip>
          <Avatar user={q.author} size={20} />
          <span className="qa-author">{q.author.nickname}</span>
          <span className="qa-dot">·</span>
          <span>{timeAgo(q.createdAt)}</span>
          <span className="qa-dot">·</span>
          <span>{fmtNum(q.viewCount)} 浏览</span>
        </div>
      </div>
      {q.bounty > 0 && (
        <div className="qa-bounty"><Icon name="coin" size={14} /> {q.bounty}</div>
      )}
    </Link>
  );
}

export default function QA() {
  const { user, setAuthOpen } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [cat, setCat] = useState('全部');
  const [list, setList] = useState<any[] | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const load = useCallback(() => {
    setList(null);
    const params: Record<string, string> = { sort: 'new' };
    if (status !== 'all') params.status = status;
    if (cat !== '全部') params.category = cat;
    api.get('/qa', { params }).then(({ data }) => setList(data.questions)).catch(() => setList([]));
  }, [status, cat]);

  useEffect(() => { load(); }, [load]);

  return (
    <Shell>
      <Card shadow="sm" radius="lg" className="mb-4 border border-default-200">
        <CardBody className="flex-row items-center gap-3">
          <div className="grow">
            <h1 className="text-xl font-extrabold flex items-center gap-2">
              <Icon name="help" size={20} style={{ color: 'var(--brand)' }} /> 问答 · 悬赏求助
            </h1>
            <p className="text-default-500 text-small mt-1">有问题大胆问，设置积分悬赏更快得到解答。</p>
          </div>
          <Button color="primary" radius="full" startContent={<Icon name="edit" size={16} />}
            onPress={() => user ? onOpen() : setAuthOpen(true)}>我要提问</Button>
        </CardBody>
      </Card>

      <div className="qa-filters mb-3">
        <Tabs aria-label="状态" color="primary" variant="solid" radius="lg"
          selectedKey={status} onSelectionChange={(k: any) => setStatus(k)}>
          {STATUS.map((s) => <Tab key={s.k} title={s.t} />)}
        </Tabs>
        <Select aria-label="分类" size="sm" selectedKeys={[cat]} className="qa-cat-select"
          onChange={(e: any) => setCat(e.target.value)} variant="bordered">
          {['全部', ...CATS].map((c) => <SelectItem key={c}>{c}</SelectItem>)}
        </Select>
      </div>

      {list === null ? (
        <QaListSkeleton rows={6} />
      ) : list.length === 0 ? (
        <div className="ui-card"><Empty icon="🔍" text="还没有相关问题，来提第一个问吧" /></div>
      ) : (
        <Card shadow="sm" radius="lg" className="border border-default-200 overflow-hidden">
          <CardBody className="p-0">
            {list.map((q) => <QuestionRow key={q.id} q={q} />)}
          </CardBody>
        </Card>
      )}

      <AskModal isOpen={isOpen} onOpenChange={onOpenChange} points={user?.points || 0}
        onAsked={(q: any) => navigate(`/qa/${q.id}`)} />
    </Shell>
  );
}

function AskModal({ isOpen, onOpenChange, onAsked, points }: { isOpen: boolean; onOpenChange: any; onAsked?: (q: any) => void; points: number }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('综合');
  const [bounty, setBounty] = useState('');
  const [busy, setBusy] = useState(false);
  const [titleErr, setTitleErr] = useState('');

  const submit = async (close: () => void) => {
    // 就地校验（spec 01 §1.3）：必填缺失不再弹 toast，错误显示在字段下方并聚焦该字段
    if (!title.trim()) {
      setTitleErr('请填写问题标题');
      setTimeout(() => document.querySelector<HTMLInputElement>('.qa-ask-title input')?.focus(), 0);
      return;
    }
    const b = Math.max(0, Math.floor(Number(bounty) || 0));
    if (b > points) return toast.err('悬赏积分超过了你的余额');
    setBusy(true);
    try {
      const { data } = await api.post('/qa', { title, body, category, bounty: b });
      toast.ok(b > 0 ? `发布成功，已托管 ${b} 积分悬赏 🎉` : '发布成功 🎉');
      close(); setTitle(''); setBody(''); setBounty(''); setTitleErr('');
      onAsked?.(data.question);
    } catch (err: any) { toast.err(err.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center" backdrop="blur" size="lg">
      <ModalContent>
        {(close: () => void) => (
          <>
            <ModalHeader className="flex-col items-start gap-1">
              <span>我要提问</span>
              <span className="text-default-400 text-tiny font-normal">问题清晰、有细节，更容易得到好答案</span>
            </ModalHeader>
            <ModalBody>
              <div>
                <Input className="qa-ask-title" label="问题标题" placeholder="一句话说清你的问题" value={title}
                  onValueChange={(v: string) => { setTitle(v); if (titleErr) setTitleErr(''); }}
                  maxLength={60} isRequired variant="bordered" />
                {titleErr && <div className="field-err"><Icon name="close" size={13} /> {titleErr}</div>}
              </div>
              <Textarea label="补充说明（选填）" placeholder="背景、你已经尝试过什么、期望的答案…"
                value={body} onValueChange={setBody} onKeyDown={onCtrlEnter(() => submit(close))} maxLength={2000} minRows={4} variant="bordered" />
              <div className="flex gap-3">
                <Select label="分类" selectedKeys={[category]} onChange={(e: any) => setCategory(e.target.value)}
                  variant="bordered" className="flex-1">
                  {CATS.map((c) => <SelectItem key={c}>{c}</SelectItem>)}
                </Select>
                <Input type="number" label="悬赏积分（选填）" value={bounty} onValueChange={setBounty}
                  min={0} variant="bordered" className="flex-1"
                  startContent={<Icon name="coin" size={15} style={{ color: 'var(--gold)' }} />}
                  description={`可用 ${fmtNum(points)} 积分`} />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={close}>取消</Button>
              <Button color="primary" isLoading={busy} onPress={() => submit(close)}>发布问题</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
