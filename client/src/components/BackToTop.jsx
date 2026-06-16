import { useState, useEffect } from 'react';
import Icon from './Icon';

export default function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="回到顶部">
      <Icon name="back" size={20} style={{ transform: 'rotate(90deg)' }} />
    </button>
  );
}
