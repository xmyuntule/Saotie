import Icon from './Icon';
import { useCompose } from '../context/ComposeContext';
import { useAuth } from '../context/AuthContext';

// Mobile-only floating compose button.
export default function ComposeFab() {
  const { openCompose } = useCompose();
  const { user } = useAuth();
  if (!user) return null;
  return (
    <button className="compose-fab" onClick={openCompose} aria-label="发布动态">
      <Icon name="edit" size={24} />
    </button>
  );
}
