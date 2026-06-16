import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function MediaGrid({ media = [] }) {
  const [idx, setIdx] = useState(null); // open image index, or null
  const imgsAll = media.filter((m) => m.type === 'image');
  const touchX = useRef(null);

  useEffect(() => {
    if (idx === null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setIdx(null);
      else if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % imgsAll.length);
      else if (e.key === 'ArrowLeft') setIdx((i) => (i - 1 + imgsAll.length) % imgsAll.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, imgsAll.length]);

  if (!media.length) return null;
  const images = media.filter((m) => m.type === 'image');
  const video = media.find((m) => m.type === 'video');
  const audio = media.find((m) => m.type === 'audio');

  if (video) {
    return (
      <div className="media-video" onClick={(e) => e.stopPropagation()}>
        <video controls preload="metadata" poster={video.poster || undefined} playsInline
          src={video.url} style={{ width: '100%', maxHeight: 460, borderRadius: 'var(--r-sm)', background: '#000', display: 'block' }} />
      </div>
    );
  }

  if (audio && !images.length) {
    return (
      <div className="audio-player" onClick={(e) => e.stopPropagation()}>
        <div className="audio-cover" style={audio.cover ? { backgroundImage: `url(${audio.cover})` } : {}}>
          {!audio.cover && <span style={{ fontSize: 26 }}>🎵</span>}
        </div>
        <div className="audio-body">
          <div className="audio-title">{audio.title || '未命名音频'}</div>
          {audio.artist && <div className="audio-artist">{audio.artist}</div>}
          <audio controls preload="none" src={audio.url} style={{ width: '100%', marginTop: 8, height: 34 }} />
        </div>
      </div>
    );
  }

  const n = Math.min(images.length, 9);
  const go = (e, d) => { e.stopPropagation(); setIdx((i) => (i + d + imgsAll.length) % imgsAll.length); };
  const onTouchStart = (e) => { touchX.current = e.changedTouches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 45 && imgsAll.length > 1) setIdx((i) => (i + (dx < 0 ? 1 : -1) + imgsAll.length) % imgsAll.length);
  };
  return (
    <>
      <div className={`media-grid n${n}`} onClick={(e) => e.stopPropagation()}>
        {images.slice(0, 9).map((m, i) => (
          <div className="media-cell" key={i} onClick={() => setIdx(i)}>
            <img src={m.url} alt="" loading="lazy" />
          </div>
        ))}
      </div>
      {idx !== null && createPortal(
        <div className="lightbox" onClick={() => setIdx(null)}>
          <button className="lb-close" aria-label="关闭" onClick={() => setIdx(null)}>✕</button>
          {imgsAll.length > 1 && <button className="lb-nav lb-prev" aria-label="上一张" onClick={(e) => go(e, -1)}>‹</button>}
          <img src={imgsAll[idx]?.url} alt="" onClick={(e) => e.stopPropagation()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} />
          {imgsAll.length > 1 && <button className="lb-nav lb-next" aria-label="下一张" onClick={(e) => go(e, 1)}>›</button>}
          {imgsAll.length > 1 && <div className="lb-counter">{idx + 1} / {imgsAll.length}</div>}
        </div>,
        document.body,
      )}
    </>
  );
}
