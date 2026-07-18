import { useState, type CSSProperties } from 'react';
import Icon from './Icon';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

type ShareImageInput = string | { type?: string; url?: string; cover?: string; poster?: string } | null | undefined;

interface ShareToPostButtonProps {
  typeLabel: string;
  title: string;
  summary?: string;
  path: string;
  images?: ShareImageInput[];
  imageSourceText?: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
  onShared?: (post: any) => void;
}

const IMAGE_URL_RE = /https?:\/\/[^\s"'<>）)]+?\.(?:jpe?g|png|webp|gif|avif)(?:\?[^\s"'<>）)]*)?/gi;
const MD_IMAGE_RE = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HTML_IMAGE_RE = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;

function cleanText(raw?: string) {
  return (raw || '')
    .replace(MD_IMAGE_RE, '')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerpt(raw?: string, max = 120) {
  const text = cleanText(raw);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === 'undefined') return path;
  return new URL(path || '/', window.location.origin).toString();
}

function pushUrl(out: string[], raw?: string | null, requireImageExt = false) {
  const url = (raw || '').trim();
  if (!url || out.includes(url)) return;
  const isSafe = /^https?:\/\//i.test(url) || /^\/[^/]/.test(url);
  if (!isSafe) return;
  if (requireImageExt && !/\.(jpe?g|png|webp|gif|avif)(?:[?#].*)?$/i.test(url)) return;
  out.push(url);
}

function imageUrlsFromText(text?: string) {
  const out: string[] = [];
  for (const m of (text || '').matchAll(MD_IMAGE_RE)) pushUrl(out, m[1]);
  for (const m of (text || '').matchAll(HTML_IMAGE_RE)) pushUrl(out, m[1]);
  for (const m of (text || '').matchAll(IMAGE_URL_RE)) pushUrl(out, m[0], true);
  return out;
}

function normalizeImages(images?: ShareImageInput[], sourceText?: string) {
  const out: string[] = [];
  for (const item of images || []) {
    if (!item) continue;
    if (typeof item === 'string') {
      pushUrl(out, item);
      continue;
    }
    if (item.type && item.type !== 'image') continue;
    pushUrl(out, item.url || item.cover || item.poster || '');
  }
  for (const url of imageUrlsFromText(sourceText)) pushUrl(out, url);
  return out.slice(0, 9).map((url) => ({ type: 'image', url }));
}

export default function ShareToPostButton({
  typeLabel,
  title,
  summary,
  path,
  images,
  imageSourceText,
  className = 'btn btn-outline btn-sm',
  style,
  label = '分享到动态',
  onShared,
}: ShareToPostButtonProps) {
  const { user, setAuthOpen } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!user) return setAuthOpen(true);
    if (busy) return;
    const url = absoluteUrl(path);
    const intro = excerpt(summary);
    const content = [
      `分享${typeLabel}：${cleanText(title) || '值得一看'}`,
      intro,
      `查看详情：${url}`,
    ].filter(Boolean).join('\n\n');
    const media = normalizeImages(images, imageSourceText);
    setBusy(true);
    try {
      const device = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? '手机端' : '电脑端';
      const { data } = await api.post('/posts', {
        content,
        media,
        mediaType: media.length ? 'image' : 'text',
        visibility: 'public',
        device,
      });
      toast.ok('已分享到动态');
      onShared?.(data.post);
    } catch (err) {
      toast.err((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className={className} style={{ flex: 'none', ...style }} onClick={share} disabled={busy}>
      <Icon name="share" size={16} /> {busy ? '分享中...' : label}
    </button>
  );
}
