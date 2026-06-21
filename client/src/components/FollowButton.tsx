import { useState, useEffect } from 'react';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';

interface FollowButtonProps {
  user: any;
  size?: string;
  onChange?: (following: boolean) => void;
}

// Reusable follow/unfollow toggle. Hidden for self and logged-out viewers.
export default function FollowButton({ user, size = 'sm', onChange }: FollowButtonProps) {
  const { user: me, setAuthOpen } = useAuth();
  const toast = useToast();
  const [following, setFollowing] = useState(!!user.isFollowing);

  useEffect(() => { setFollowing(!!user.isFollowing); }, [user.id, user.isFollowing]);

  if (me && me.id === user.id) return null;

  // 乐观更新：先即时切换 UI（与点赞手感一致），后台请求，失败回滚、与服务端不一致则校正
  const toggle = async (e?: React.MouseEvent) => {
    e?.preventDefault?.(); e?.stopPropagation?.();
    if (!me) return setAuthOpen(true);
    const next = !following;
    setFollowing(next);
    onChange?.(next);
    toast.show(next ? `已关注 ${user.nickname}` : '已取消关注');
    try {
      const { data } = await api.post(`/users/${user.id}/follow`);
      if (data.following !== next) { setFollowing(data.following); onChange?.(data.following); }
    } catch (err: any) {
      setFollowing(!next); onChange?.(!next); // 回滚
      toast.err(err.message);
    }
  };

  return (
    <button className={`btn btn-${size} follow-btn ${following ? 'btn-ghost following' : 'btn-outline'}`} onClick={toggle}>
      {following
        ? <><span className="fb-on">已关注</span><span className="fb-off">取消关注</span></>
        : <><Icon name="plus" size={14} /> 关注</>}
    </button>
  );
}
