import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, Button, Progress } from '../components/heroui';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import { Empty, AchievementsSkeleton } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLayout } from '../context/SiteContext';
import api from '../api/client';
import { fmtNum } from '../lib/format';

const TIER_LABEL: Record<string, string> = { bronze: '青铜', silver: '白银', gold: '黄金' };

// 根据任务文案推断「去完成」应跳转的页面，让按钮真正可达成而非灰色禁用占位。
function taskRoute(task: any): string {
  if (task.route) return task.route;
  const t = `${task.title || ''}${task.desc || ''}`;
  if (/签到|连续登录/.test(t)) return '/member';
  if (/私信|聊天|消息/.test(t)) return '/messages';
  if (/问答|回答|提问/.test(t)) return '/qa';
  if (/圈子/.test(t)) return '/circles';
  if (/帖|论坛|板块/.test(t)) return '/forum';
  return '/';
}

function TaskRow({ task, onClaim, busy }: { task: any; onClaim: (task: any) => void; busy: boolean }) {
  const navigate = useNavigate();
  const pct = Math.round((task.progress / task.target) * 100);
  return (
    <div className="task-row">
      <span className={`task-ico${task.done ? ' done' : ''}`}><Icon name={task.icon} size={20} /></span>
      <div className="task-main">
        <div className="task-title-row">
          <span className="task-title">{task.title}</span>
          {task.daily && <span className="task-tag">每日</span>}
        </div>
        <div className="task-desc">{task.desc}</div>
        <div className="task-prog">
          <Progress size="sm" aria-label={task.title} value={pct}
            color={task.done ? 'success' : 'primary'} className="task-bar" />
          <span className="task-prog-num">{Math.min(task.progress, task.target)}/{task.target}</span>
        </div>
      </div>
      <div className="task-reward">
        <span className="task-points"><Icon name="coin" size={13} /> +{task.points}</span>
        {task.claimed ? (
          <Button size="sm" variant="flat" isDisabled className="task-btn">已领取</Button>
        ) : task.claimable ? (
          <Button size="sm" color="primary" className="task-btn" isLoading={busy} onPress={() => onClaim(task)}>领取</Button>
        ) : task.done ? (
          <Button size="sm" variant="flat" isDisabled className="task-btn">已完成</Button>
        ) : (
          <Button size="sm" variant="bordered" color="primary" className="task-btn"
            onPress={() => navigate(taskRoute(task))}>去完成</Button>
        )}
      </div>
    </div>
  );
}

function BadgeCell({ badge }: { badge: any }) {
  return (
    <div className={`badge-cell${badge.unlocked ? ' on' : ''} tier-${badge.tier}`}>
      <span className="badge-medal"><Icon name={badge.icon} size={26} /></span>
      <span className="badge-name">{badge.name}</span>
      <span className="badge-desc">{badge.desc}</span>
      {!badge.unlocked && <span className="badge-lock"><Icon name="lock" size={11} /> 未解锁</span>}
    </div>
  );
}

export default function Achievements() {
  const { user, setAuthOpen, patchUser } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [busyKey, setBusyKey] = useState<any>(null);

  const load = useCallback(() => {
    if (!user) return;
    api.get('/achievements').then(({ data }) => setData(data)).catch(() => setData({ tasks: [], badges: [] }));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const claim = async (task: any) => {
    setBusyKey(task.key);
    try {
      const { data: r } = await api.post(`/achievements/claim/${task.key}`);
      patchUser?.(r.user);
      toast.ok(`领取成功，+${r.points} 积分`);
      setData((d: any) => ({
        ...d,
        tasks: d.tasks.map((t: any) => t.key === task.key ? { ...t, claimed: true, claimable: false } : t),
        claimablePoints: Math.max(0, (d.claimablePoints || 0) - task.points),
      }));
    } catch (err: any) { toast.err(err.message); }
    finally { setBusyKey(null); }
  };

  const layout = useLayout('achievements', 'wide');
  if (!user) return <Shell layout={layout}><div className="ui-card"><Empty icon="🔒" text="登录后查看任务与成就" /></div></Shell>;
  if (!data) return <Shell layout={layout}><AchievementsSkeleton /></Shell>;

  const daily = data.tasks.filter((t: any) => t.daily);
  const growth = data.tasks.filter((t: any) => !t.daily);

  return (
    <Shell layout={layout}>
      <Card shadow="sm" radius="lg" className="mb-4 ach-hero overflow-hidden">
        <CardBody className="ach-hero-body">
          <div>
            <h1 className="text-xl font-extrabold flex items-center gap-2">
              <Icon name="trend" size={20} /> 任务中心
            </h1>
            <p className="text-small mt-1 opacity-85">每天做任务领积分，解锁成就点亮勋章墙。</p>
          </div>
          <div className="ach-hero-stats">
            <div className="ahs"><b>{fmtNum(user.points)}</b><span>我的积分</span></div>
            <div className="ahs"><b>{data.unlockedCount || 0}</b><span>已解锁勋章</span></div>
            <div className="ahs"><b>{data.claimablePoints || 0}</b><span>今日可领</span></div>
          </div>
        </CardBody>
      </Card>

      {/* 宽屏下每日/成长任务并排两列（.ach-tasks 仅在 .shell-wide 下变 grid；窄屏/三栏时块级堆叠不变） */}
      <div className="ach-tasks">
        <div className="ach-task-col">
          <div className="sec-head"><Icon name="checkin" size={16} /> 每日任务</div>
          <Card shadow="sm" radius="lg" className="border border-default-200 overflow-hidden mb-4">
            <CardBody className="p-0">
              {daily.map((t: any) => <TaskRow key={t.key} task={t} onClaim={claim} busy={busyKey === t.key} />)}
            </CardBody>
          </Card>
        </div>
        {growth.length > 0 && (
          <div className="ach-task-col">
            <div className="sec-head"><Icon name="trend" size={16} /> 成长任务</div>
            <Card shadow="sm" radius="lg" className="border border-default-200 overflow-hidden mb-4">
              <CardBody className="p-0">
                {growth.map((t: any) => <TaskRow key={t.key} task={t} onClaim={claim} busy={busyKey === t.key} />)}
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      <div className="sec-head"><Icon name="shield" size={16} /> 成就勋章 <span className="sec-sub">{data.unlockedCount}/{data.badges.length}</span></div>
      <Card shadow="sm" radius="lg" className="border border-default-200">
        <CardBody>
          <div className="badge-grid">
            {data.badges.map((b: any) => <BadgeCell key={b.key} badge={b} />)}
          </div>
        </CardBody>
      </Card>
    </Shell>
  );
}
