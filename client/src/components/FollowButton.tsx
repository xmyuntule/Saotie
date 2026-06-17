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
  const [busy, setBusy] = useState(false);

  useEffect(() => { setFollowing(!!user.isFollowing); }, [user.id, user.isFollowing]);

  if (me && me.id === user.id) return null;

  const toggle = async (e?: React.MouseEvent) => {
    e?.preventDefault?.(); e?.stopPropagation?.();
    if (!me) return setAuthOpen(true);
    setBusy(true);
    try {
      const { data } = await api.post(`/users/${user.id}/follow`);
      setFollowing(data.following);
      onChange?.(data.following);
      toast.show(data.following ? `已关注 ${user.nickname}` : '已取消关注');
    } catch (err: any) { toast.err(err.message); }
    finally { setBusy(false); }
  };

  return (
    <button className={`btn btn-${size} follow-btn ${following ? 'btn-ghost following' : 'btn-outline'}`} disabled={busy} onClick={toggle}>
      {following
        ? <><span className="fb-on">已关注</span><span className="fb-off">取消关注</span></>
        : <><Icon name="plus" size={14} /> 关注</>}
    </button>
  );
}
