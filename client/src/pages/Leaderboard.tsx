import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, Tab } from '../components/heroui';
import Shell from '../components/Shell';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import { Badges } from '../components/Identity';
import { LeaderboardSkeleton } from '../components/States';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { fmtNum } from '../lib/format';

const BOARDS = [
  { key: 'wealth', title: '财富榜', metric: (u: any) => `${fmtNum(u.points || 0)}`, unit: '积分', rule: '按账号「积分」总量排名。发优质内容、参与活动、每日签到都能赚积分。' },
  { key: 'level', title: '等级榜', metric: (u: any) => `Lv.${u.level || 1}`, unit: '', rule: '按账号「等级」排名。活跃互动累积经验值即可升级。' },
  { key: 'fans', title: '人气榜', metric: (u: any) => `${fmtNum(u.followers || 0)}`, unit: '粉丝', rule: '按「粉丝数」排名。持续输出好内容、多与大家互动更容易涨粉。' },
  { key: 'checkin', title: '签到榜', metric: (u: any) => `${u.checkinStreak || 0}`, unit: '天', rule: '按「连续签到天数」排名。每天坚持签到，冲击榜首吧。' },
];

function LeaderSide({ board, users, me }: any) {
  const myIdx = me && Array.isArray(users) ? users.findIndex((u: any) => u.id === me.id) : -1;
  return (
    <div className="flex flex-col gap-3">
      <div className="ui-card lb-side-me">
        <div className="widget-title" style={{ fontSize: 14 }}><Icon name="trend" size={15} /> 我的{board.title}</div>
        {me ? (
          <Link to={`/u/${me.username}`} className="lb-me-row">
            <span className={`lb-me-rank${myIdx >= 0 && myIdx < 3 ? ` r${myIdx + 1}` : ''}`}>{myIdx >= 0 ? `#${myIdx + 1}` : '—'}</span>
            <Avatar user={me} size={40} showV ring />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="uname" style={{ fontSize: 14 }}>{me.nickname}</div>
              <div className="faint" style={{ fontSize: 12 }}>{myIdx >= 0 ? '已上榜，继续保持～' : '尚未上榜，加油冲～'}</div>
            </div>
            <span className="lb-metric"><b className="num">{board.metric(me)}</b>{board.unit && <span className="lb-unit"> {board.unit}</span>}</span>
          </Link>
        ) : <div className="faint" style={{ fontSize: 13 }}>登录后查看你的排名</div>}
      </div>
      <div className="ui-card" style={{ padding: 16 }}>
        <div className="widget-title" style={{ fontSize: 14 }}><Icon name="spark" size={15} /> 上榜规则</div>
        <p className="faint" style={{ fontSize: 13, lineHeight: 1.7, marginTop: 8 }}>{board.rule}</p>
        <div className="lb-rule-tags">
          {BOARDS.map((b) => <span key={b.key} className={`lb-rule-tag${b.key === board.key ? ' on' : ''}`}>{b.title}</span>)}
        </div>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [type, setType] = useState('wealth');
  const [users, setUsers] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    setUsers(null);
    api.get(`/users/ranking/${type}`).then(({ data }) => { if (alive) setUsers(data.users); }).catch(() => alive && setUsers([]));
    return () => { alive = false; };
  }, [type]);

  const board = BOARDS.find((b) => b.key === type)!;
  const podium = Array.isArray(users) && users.length >= 3 ? users.slice(0, 3) : [];
  const rest = podium.length ? users.slice(3) : (users || []);

  return (
    <Shell right={<LeaderSide board={board} users={users} me={user} />}>
      <div className="lb-head">
        <div className="lb-head-ico"><Icon name="trend" size={24} /></div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.01em' }}>排行榜</h1>
          <p className="faint" style={{ fontSize: 13, marginTop: 2 }}>看看社区里最活跃、最有人气的小伙伴们</p>
        </div>
      </div>

      <Tabs aria-label="排行榜" color="primary" variant="solid" radius="lg" fullWidth
        selectedKey={type} onSelectionChange={(k: any) => setType(k)} className="mb-3">
        {BOARDS.map((b) => <Tab key={b.key} title={b.title} />)}
      </Tabs>

      {users === null ? (
        <LeaderboardSkeleton rows={8} />
      ) : users.length === 0 ? (
        <div className="ui-card"><div className="center faint" style={{ padding: 36 }}>暂无数据</div></div>
      ) : (
        <>
          {podium.length === 3 && (
            <div className="lb-podium">
              {[1, 0, 2].map((idx) => {
                const u = users[idx]; const r = idx + 1;
                return (
                  <Link to={`/u/${u.username}`} key={u.id} className={`lb-podium-item r${r}`}>
                    <span className="lb-podium-medal">{r === 1 ? '🥇' : r === 2 ? '🥈' : '🥉'}</span>
                    <Avatar user={u} size={r === 1 ? 66 : 54} showV ring />
                    <div className="lb-podium-name">{u.nickname}</div>
                    <div className="lb-podium-metric"><b className="num">{board.metric(u)}</b>{board.unit && ` ${board.unit}`}</div>
                  </Link>
                );
              })}
            </div>
          )}
          {rest.length > 0 && (
            <div className="ui-card" style={{ overflow: 'hidden', padding: 0 }}>
              {rest.map((u: any, i: number) => {
                const rank = (podium.length ? 3 : 0) + i + 1;
                return (
                  <Link to={`/u/${u.username}`} key={u.id} className="lb-row">
                    <span className={`lb-rank${rank <= 3 ? ` top r${rank}` : ''}`}>{rank}</span>
                    <Avatar user={u} size={42} showV />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="uname" style={{ fontSize: 14.5 }}>{u.nickname} <Badges user={u} showLevel={false} /></div>
                      <div className="faint" style={{ fontSize: 12 }}>@{u.username}</div>
                    </div>
                    <span className="lb-metric"><b className="num">{board.metric(u)}</b>{board.unit && <span className="lb-unit"> {board.unit}</span>}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
