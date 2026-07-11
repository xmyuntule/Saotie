import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Card, CardBody, Tabs, Tab, Button, Chip,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Input, Textarea, Select, SelectItem, useDisclosure,
} from '../components/heroui';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import { Empty, CircleGridSkeleton } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLayout } from '../context/SiteContext';
import api from '../api/client';
import { fmtNum } from '../lib/format';

const CATS = ['全部', '兴趣', '科技', '生活', '创作', '同城'];
const CAT_COLOR: Record<string, string> = { 兴趣: 'secondary', 科技: 'primary', 生活: 'warning', 创作: 'danger', 同城: 'success' };
const ICONS = ['compass', 'camera', 'code', 'rocket', 'heart', 'book', 'fire', 'edit', 'forum', 'coin'];
const COLORS = ['#2b54f0', '#7c3aed', '#059f76', '#ef6c12', '#e11d6b', '#0e8fb8', '#f59e0b'];

function CircleCard({ c, onToggle, busy }: { c: any; onToggle: (c: any) => void; busy: boolean }) {
  const color = c.color || '#2b54f0';
  return (
    <Card shadow="sm" radius="lg" isPressable as={Link} to={`/circle/${encodeURIComponent(c.slug)}`}
      className="border border-default-200 w-full text-left transition-transform hover:-translate-y-0.5">
      <CardBody className="gap-3">
        <div className="flex items-start gap-3">
          <span className="circle-ico" style={{ '--cc': color } as React.CSSProperties}>
            <Icon name={c.icon || 'circle'} size={22} />
          </span>
          <div className="grow min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[15.5px] truncate">{c.name}</span>
              <Chip size="sm" variant="flat" color={CAT_COLOR[c.category] || 'default'} className="shrink-0">{c.category}</Chip>
            </div>
            <div className="text-default-500 text-[12.5px] mt-1">
              {fmtNum(c.memberCount)} 成员 · {fmtNum(c.postCount)} 动态
            </div>
          </div>
          <Button size="sm" radius="full" variant={c.joined ? 'flat' : 'solid'} color={c.joined ? 'default' : 'primary'}
            isLoading={busy} className="shrink-0"
            startContent={c.joined ? <Icon name="check" size={13} /> : undefined}
            onPress={(e: any) => { onToggle(c); }}
            // prevent the card's Link navigation when tapping the button
            onClick={(e: any) => { e.preventDefault(); e.stopPropagation(); }}>
            {c.joined ? '已加入' : '加入'}
          </Button>
        </div>
        <p className="text-default-600 text-[13px] leading-relaxed line-clamp-2 min-h-[2.6em]">
          {c.description || '这个圈子还没有简介～'}
        </p>
      </CardBody>
    </Card>
  );
}

export default function Circles() {
  const { user, setAuthOpen } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [cat, setCat] = useState('全部');
  const [list, setList] = useState<any[] | null>(null);
  const [busyId, setBusyId] = useState<any>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const load = useCallback(() => {
    setList(null);
    const params: Record<string, string> = { sort: 'hot' };
    if (cat !== '全部') params.category = cat;
    api.get('/circles', { params }).then(({ data }) => setList(data.circles)).catch(() => setList([]));
  }, [cat]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (c: any) => {
    if (!user) return setAuthOpen(true);
    setBusyId(c.id);
    try {
      const { data } = await api.post(`/circles/${c.id}/${c.joined ? 'leave' : 'join'}`);
      setList((prev) => (prev || []).map((x) => x.id === c.id ? { ...x, joined: data.joined, memberCount: data.memberCount } : x));
    } catch (err: any) { toast.err(err.message); }
    finally { setBusyId(null); }
  };

  const layout = useLayout('circles', 'wide');
  return (
    <Shell layout={layout}>
      <Card shadow="sm" radius="lg" className="mb-4 border border-default-200">
        <CardBody className="flex-row items-center gap-3">
          <div className="grow">
            <h1 className="text-xl font-extrabold flex items-center gap-2">
              <Icon name="users" size={20} style={{ color: 'var(--brand)' }} /> 圈子
            </h1>
            <p className="text-default-500 text-small mt-1">找到同好，加入兴趣社群，一起聊点喜欢的。</p>
          </div>
          <Button color="primary" radius="full" className="action-btn-balanced" startContent={<Icon name="plus" size={16} />}
            onPress={() => user ? onOpen() : setAuthOpen(true)}>创建圈子</Button>
        </CardBody>
      </Card>

      <Tabs aria-label="圈子分类" color="primary" variant="solid" radius="lg" fullWidth
        selectedKey={cat} onSelectionChange={(k: any) => setCat(k)} className="mb-3">
        {CATS.map((c) => <Tab key={c} title={c} />)}
      </Tabs>

      {list === null ? (
        <CircleGridSkeleton count={6} />
      ) : list.length === 0 ? (
        <div className="ui-card"><Empty icon="🧭" text="还没有圈子，成为第一个创建圈子的人吧" /></div>
      ) : (
        <div className="circle-grid">
          {list.map((c) => <CircleCard key={c.id} c={c} onToggle={toggle} busy={busyId === c.id} />)}
        </div>
      )}

      <CreateCircleModal isOpen={isOpen} onOpenChange={onOpenChange}
        onCreated={(c: any) => navigate(`/circle/${encodeURIComponent(c.slug)}`)} />
    </Shell>
  );
}

function CreateCircleModal({ isOpen, onOpenChange, onCreated }: { isOpen: boolean; onOpenChange: any; onCreated?: (c: any) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('兴趣');
  const [icon, setIcon] = useState('compass');
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);

  const submit = async (close: () => void) => {
    if (!name.trim()) return toast.err('给圈子起个名字吧');
    setBusy(true);
    try {
      const { data } = await api.post('/circles', { name, description: desc, category, icon, color });
      toast.ok('圈子创建成功 🎉');
      close();
      setName(''); setDesc('');
      onCreated?.(data.circle);
    } catch (err: any) { toast.err(err.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center" backdrop="blur" size="md">
      <ModalContent>
        {(close: () => void) => (
          <>
            <ModalHeader className="flex-col items-start gap-1">
              <span>创建圈子</span>
              <span className="text-default-400 text-tiny font-normal">建好后你将成为圈主</span>
            </ModalHeader>
            <ModalBody>
              <div className="flex items-center gap-3 mb-1">
                <span className="circle-ico circle-ico-lg" style={{ '--cc': color } as React.CSSProperties}><Icon name={icon} size={26} /></span>
                <div className="text-default-500 text-tiny">选择一个图标和主题色，<br />让圈子更有辨识度。</div>
              </div>
              <Input label="圈子名称" value={name} onValueChange={setName} maxLength={24} isRequired variant="bordered" />
              <Textarea label="一句话简介" value={desc} onValueChange={setDesc} maxLength={200} minRows={2} variant="bordered" />
              <Select label="分类" selectedKeys={[category]} onChange={(e: any) => setCategory(e.target.value)} variant="bordered">
                {CATS.filter((c) => c !== '全部').map((c) => <SelectItem key={c}>{c}</SelectItem>)}
              </Select>
              <div>
                <div className="text-tiny text-default-500 mb-1.5">图标</div>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((ic) => (
                    <button key={ic} type="button" onClick={() => setIcon(ic)}
                      className={`icon-pick${icon === ic ? ' on' : ''}`}><Icon name={ic} size={18} /></button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-tiny text-default-500 mb-1.5">主题色</div>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((cl) => (
                    <button key={cl} type="button" onClick={() => setColor(cl)}
                      className={`color-pick${color === cl ? ' on' : ''}`} style={{ background: cl }} />
                  ))}
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={close}>取消</Button>
              <Button color="primary" isLoading={busy} onPress={() => submit(close)}>创建</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
