import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

interface MediaItem {
  type: string;
  url: string;
  poster?: string;
  cover?: string;
  title?: string;
  artist?: string;
  [key: string]: any;
}

export default function MediaGrid({ media = [] }: { media?: MediaItem[] }) {
  const [idx, setIdx] = useState<number | null>(null); // open image index, or null
  const [broken, setBroken] = useState<Set<number>>(new Set()); // cells whose image 404'd
  const imgsAll = media.filter((m) => m.type === 'image');
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (idx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIdx(null);
      else if (e.key === 'ArrowRight') setIdx((i) => ((i as number) + 1) % imgsAll.length);
      else if (e.key === 'ArrowLeft') setIdx((i) => ((i as number) - 1 + imgsAll.length) % imgsAll.length);
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
        {/* size to the video's natural aspect (height-capped + centered) so portrait
           clips don't get pillar-boxed with big black bars; landscape still fills width */}
        <video controls preload="metadata" poster={video.poster || undefined} playsInline
          src={video.url} className="media-video-el"
          onLoadedMetadata={(e) => { const v = e.currentTarget; if (v.videoHeight > v.videoWidth) v.closest('.media-video')?.classList.add('portrait'); }} />
      </div>
    );
  }

  if (audio && !images.length) {
    return (
      <div className="audio-player" onClick={(e) => e.stopPropagation()}>
        <div className="audio-cover" style={audio.cover ? { backgroundImage: `url(${audio.cover})` } : {}}>
          {!audio.cover && <Icon name="music" size={26} />}
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
  const go = (e: React.MouseEvent, d: number) => { e.stopPropagation(); setIdx((i) => ((i as number) + d + imgsAll.length) % imgsAll.length); };
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.changedTouches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 45 && imgsAll.length > 1) setIdx((i) => ((i as number) + (dx < 0 ? 1 : -1) + imgsAll.length) % imgsAll.length);
  };
  return (
    <>
      <div className={`media-grid n${n}`} onClick={(e) => e.stopPropagation()}>
        {images.slice(0, 9).map((m, i) => (
          <div className={`media-cell${broken.has(i) ? ' media-cell-broken' : ''}`} key={i}
            onClick={() => { if (!broken.has(i)) setIdx(i); }}>
            {broken.has(i) ? (
              <span className="media-broken" aria-label="图片加载失败"><Icon name="image" size={22} /></span>
            ) : (
              <img src={m.url} alt="" loading="lazy" onError={() => setBroken((s) => new Set(s).add(i))} />
            )}
          </div>
        ))}
      </div>
      {idx !== null && createPortal(
        <div className="lightbox" onClick={() => setIdx(null)}>
          <button className="lb-close" aria-label="关闭" onClick={() => setIdx(null)}><Icon name="close" size={22} /></button>
          {imgsAll.length > 1 && <button className="lb-nav lb-prev" aria-label="上一张" onClick={(e) => go(e, -1)}><Icon name="back" size={24} /></button>}
          <img src={imgsAll[idx]?.url} alt="" onClick={(e) => e.stopPropagation()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} />
          {imgsAll.length > 1 && <button className="lb-nav lb-next" aria-label="下一张" onClick={(e) => go(e, 1)}><Icon name="back" size={24} style={{ transform: 'rotate(180deg)' }} /></button>}
          {imgsAll.length > 1 && <div className="lb-counter">{idx + 1} / {imgsAll.length}</div>}
        </div>,
        document.body,
      )}
    </>
  );
}
