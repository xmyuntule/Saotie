import { useState, useRef, useEffect, useMemo } from 'react';
import Avatar from './Avatar';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { VIS_LABELS } from '../lib/format';
import { loadDraft, saveDraft, clearDraft as clearDraftStore, hasDraft } from '../lib/draft';
import useMention from '../hooks/useMention';
import { onCtrlEnter } from '../lib/kbd';

const EMOJIS = '😀 😂 🥰 😍 😎 🤔 😴 😭 😡 👍 👏 🙏 💪 🎉 🔥 ✨ 💯 ❤️ 💔 🌈 ☕ 🍜 🎵 📷 🌙 ⭐ 🐱 🐶 🌸 🍀 🚀 💎'.split(' ');
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v)(\?.*)?$/i;
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i;

function validHttpsUrl(value: string) {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

function stripTransientMedia(items?: any[] | null) {
  return Array.isArray(items) ? items.map(({ previewUrl, ...item }) => item) : [];
}

function videoHasFrame(video: HTMLVideoElement) {
  return video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2;
}

function videoLoadErrorMessage(video: HTMLVideoElement) {
  switch (video.error?.code) {
    case 2:
      return '视频加载中断，请检查网络后重试';
    case 3:
      return '当前浏览器无法解码这个视频，请换成 H.264 MP4 或 WebM 后再上传';
    case 4:
      return '当前浏览器不支持这个视频格式或编码，请换成 H.264 MP4 或 WebM';
    default:
      return '视频暂时无法加载，请稍后重试或改用封面图片 URL';
  }
}

function waitForVideoFrame(video: HTMLVideoElement, timeoutMs = 12000) {
  if (videoHasFrame(video)) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timer = 0;
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('seeked', onReady);
      video.removeEventListener('error', onError);
    };
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    const onReady = () => {
      if (videoHasFrame(video)) finish(resolve);
    };
    const onError = () => finish(() => reject(new Error(videoLoadErrorMessage(video))));
    timer = window.setTimeout(
      () => finish(() => reject(new Error('视频仍未加载出可截取画面，请播放一下视频或换成 H.264 MP4 后再试'))),
      timeoutMs,
    );
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('seeked', onReady);
    video.addEventListener('error', onError);
    try { video.load(); } catch { /* ignore */ }
  });
}

export interface ComposerProps {
  onPosted?: (post: any) => void;
  compact?: boolean;
  prefill?: string;
  embedded?: boolean;
  circleId?: number | null;
  placeholder?: string;
}

export default function Composer({ onPosted, compact = false, prefill = '', embedded = false, circleId = null, placeholder = '' }: ComposerProps) {
  const { user, setAuthOpen } = useAuth();
  const toast = useToast();
  // 恢复结构化草稿（文本 + 图片 + 投票 + 可见性 + 位置）；有 prefill（转发/圈子预填）时不读草稿
  const initialDraft = useMemo(() => (prefill ? null : loadDraft()), [prefill]);
  const [content, setContent] = useState<string>(() => initialDraft?.content ?? prefill ?? '');
  const [media, setMedia] = useState<any[]>(() => stripTransientMedia(initialDraft?.media));
  const [vis, setVis] = useState(() => initialDraft?.vis ?? 'public');
  const [price, setPrice] = useState<any>(50);
  const [password, setPassword] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(embedded);
  const [location, setLocation] = useState(() => initialDraft?.location ?? user?.location ?? '');
  const [showLoc, setShowLoc] = useState(() => !!initialDraft?.location);
  const [poll, setPoll] = useState<any>(() => initialDraft?.poll ?? null); // { options: [], multi, days }
  const [redPacket, setRedPacket] = useState<any>(null); // { points, count, blessing } — 不持久化（含积分，避免误恢复）
  const [draftRestored, setDraftRestored] = useState(() => !prefill && hasDraft());
  const [savedHint, setSavedHint] = useState(false);
  const [videoLinkOpen, setVideoLinkOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoPosterUrl, setVideoPosterUrl] = useState('');
  const [coverTarget, setCoverTarget] = useState<number | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverVideoState, setCoverVideoState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [coverVideoMessage, setCoverVideoMessage] = useState('');
  const imageFileRef = useRef<HTMLInputElement | null>(null);
  const videoFileRef = useRef<HTMLInputElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const coverVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());
  const mention = useMention(content, setContent, taRef);
  const coverMedia = coverTarget !== null ? media[coverTarget] : null;
  const coverVideoSrc = coverMedia?.type === 'video' ? (coverMedia.previewUrl || coverMedia.url || '') : '';

  const rememberPreviewUrl = (file: File) => {
    const url = URL.createObjectURL(file);
    previewUrlsRef.current.add(url);
    return url;
  };

  const revokePreviewUrl = (url?: string) => {
    if (url?.startsWith('blob:') && previewUrlsRef.current.delete(url)) {
      URL.revokeObjectURL(url);
    }
  };

  const revokeMediaPreviewUrls = (items: any[]) => {
    items.forEach((item) => revokePreviewUrl(item?.previewUrl));
  };

  // persist a structured draft so an unsent post (文本+图片+投票+可见性+位置) survives navigation / reload (防误触丢失)
  useEffect(() => {
    setSavedHint(saveDraft({ content, media: stripTransientMedia(media), vis, poll, location }));
  }, [content, media, vis, poll, location]);

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (coverTarget !== null && (!media[coverTarget] || media[coverTarget]?.type !== 'video')) {
      setCoverTarget(null);
    }
  }, [coverTarget, media]);

  useEffect(() => {
    if (!coverVideoSrc) {
      setCoverVideoState('idle');
      setCoverVideoMessage('');
      return;
    }
    setCoverVideoState('loading');
    setCoverVideoMessage('');
  }, [coverVideoSrc]);

  const clearDraft = () => { revokeMediaPreviewUrls(media); clearDraftStore(); setContent(''); setMedia([]); setCoverTarget(null); setPoll(null); setVis('public'); setDraftRestored(false); setSavedHint(false); };

  const hasVideoMedia = media.some((m) => m?.type === 'video');
  const hasAudioMedia = media.some((m) => m?.type === 'audio');
  const cannotAddVideo = media.length > 0 || !!poll || !!redPacket;
  const videoExclusiveMessage = '视频动态不能同时添加图片、音频、投票或红包';

  useEffect(() => {
    if (videoLinkOpen && cannotAddVideo) setVideoLinkOpen(false);
  }, [cannotAddVideo, videoLinkOpen]);

  if (!user) {
    return (
      <div className="ui-card composer center" style={{ padding: 22, cursor: 'pointer' }} onClick={() => setAuthOpen(true)}
        role="button" tabIndex={0} aria-label="登录后分享你的第一条动态"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAuthOpen(true); } }}>
        <span className="muted">登录后分享你的第一条动态 →</span>
      </div>
    );
  }

  const mediaType = hasVideoMedia ? 'video'
    : hasAudioMedia ? 'music'
    : media.length ? 'image' : 'text';

  const grow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const el = e.target; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px';
    mention.scan(el.value, el.selectionStart);
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'video') => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const resetInput = () => { e.target.value = ''; };
    const isImage = (f: File) => f.type.startsWith('image/') || IMAGE_EXT_RE.test(f.name);
    const isVideo = (f: File) => f.type.startsWith('video/') || VIDEO_EXT_RE.test(f.name);
    const invalid = files.filter((f) => (kind === 'image' ? !isImage(f) : !isVideo(f)));
    if (invalid.length) {
      toast.err(kind === 'image' ? '请选择图片文件' : '请选择视频文件');
      resetInput();
      return;
    }
    if (kind === 'image' && hasVideoMedia) {
      toast.err(videoExclusiveMessage);
      resetInput();
      return;
    }
    if (kind === 'video') {
      if (files.length > 1) {
        toast.err('视频动态只能上传一个视频，不能同时添加图片或音频');
        resetInput();
        return;
      }
      if (cannotAddVideo) {
        toast.err('已有图片、音频、投票或红包时不能添加视频');
        resetInput();
        return;
      }
    }
    if (kind === 'image' && media.length >= 9) {
      toast.err('最多上传 9 个文件');
      resetInput();
      return;
    }
    const fd = new FormData();
    fd.append('purpose', 'post');
    const selectedFiles = kind === 'video' ? files.slice(0, 1) : files.slice(0, 9 - media.length);
    selectedFiles.forEach((f) => fd.append('files', f));
    try {
      const { data } = await api.post('/upload', fd);
      const uploaded = (data.files || []).map((item: any, idx: number) => {
        const source = selectedFiles[idx];
        if (kind === 'video' && item?.type === 'video') {
          return { ...item, previewUrl: rememberPreviewUrl(source) };
        }
        return item;
      });
      setMedia((m) => [...m, ...uploaded].slice(0, 9));
      if (uploaded.some((item: any) => item?.type === 'video')) {
        setCoverTarget(media.length);
      }
    } catch (err: any) { toast.err(err.message); }
    resetInput();
  };

  const uploadBlob = async (blob: Blob, filename: string) => {
    const fd = new FormData();
    fd.append('purpose', 'video-poster');
    fd.append('files', blob, filename);
    const { data } = await api.post('/upload', fd);
    return data.files?.[0]?.url || '';
  };

  const addVideoLink = () => {
    const url = validHttpsUrl(videoUrl);
    if (!url) return toast.err('请输入 https 视频直链');
    if (!VIDEO_EXT_RE.test(url)) return toast.err('暂支持 mp4、webm、mov、m4v 视频直链');
    const poster = videoPosterUrl.trim() ? validHttpsUrl(videoPosterUrl) : '';
    if (videoPosterUrl.trim() && (!poster || !IMAGE_EXT_RE.test(poster))) return toast.err('封面需为 https 图片直链');
    if (cannotAddVideo) return toast.err('已有图片、音频、投票或红包时不能添加视频外链');
    setMedia((m) => [...m, { type: 'video', url, poster, name: '外链视频', external: true }].slice(0, 9));
    setVideoUrl(''); setVideoPosterUrl(''); setVideoLinkOpen(false);
  };

  const updateMedia = (idx: number, patch: any) => {
    setMedia((list) => list.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const markCoverVideoReady = (video: HTMLVideoElement) => {
    if (!videoHasFrame(video)) return;
    setCoverVideoState('ready');
    setCoverVideoMessage('');
  };

  const captureVideoCover = async (idx: number) => {
    const video = coverVideoRef.current;
    if (!video) return;
    setCoverBusy(true);
    try {
      await waitForVideoFrame(video);
      const canvas = document.createElement('canvas');
      const maxW = 960;
      const scale = Math.min(1, maxW / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('当前浏览器不支持截取封面');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob: Blob = await new Promise((resolve, reject) => {
        try {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('封面生成失败'))), 'image/jpeg', 0.82);
        } catch (error) {
          reject(error);
        }
      });
      const url = await uploadBlob(blob, `video-cover-${Date.now()}.jpg`);
      updateMedia(idx, { poster: url });
      toast.ok('已设置视频封面');
    } catch (err: any) {
      const message = err?.name === 'SecurityError'
        ? '当前视频地址禁止浏览器截取封面，请改用封面图片 URL'
        : err?.message || '外链视频可能禁止跨域截取，请改用封面 URL';
      toast.err(message);
    } finally {
      setCoverBusy(false);
    }
  };

  const insertEmoji = (em: string) => {
    setContent((c) => c + em);
    setShowEmoji(false);
    taRef.current?.focus();
  };

  const submit = async () => {
    if (hasVideoMedia) {
      const videoCount = media.filter((m) => m?.type === 'video').length;
      if (videoCount > 1) return toast.err('一条动态暂只支持一个视频');
      if (media.length > 1 || poll || redPacket) return toast.err(videoExclusiveMessage);
    }
    const pollOpts = poll ? poll.options.map((o: any) => o.trim()).filter(Boolean) : null;
    if (poll && (!pollOpts || pollOpts.length < 2)) return toast.err('投票至少需要 2 个选项');
    if (redPacket) {
      const pts = Number(redPacket.points) || 0, cnt = Number(redPacket.count) || 0;
      if (cnt < 1) return toast.err('红包个数至少 1 个');
      if (pts < cnt) return toast.err(`${cnt} 个红包至少需要 ${cnt} 积分`);
      if ((user?.points || 0) < pts) return toast.err('积分不足，发不出这么大的红包');
    }
    if (!content.trim() && !media.length && !pollOpts && !redPacket) return toast.err('说点什么或添加图片吧');
    setBusy(true);
    try {
      const device = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? '手机端' : '电脑端';
      const { data } = await api.post('/posts', {
        content, media: stripTransientMedia(media), mediaType, visibility: vis,
        price: vis === 'paid' ? Number(price) : 0,
        password: vis === 'password' ? password : '',
        location: location.trim(), device,
        ...(circleId ? { circleId } : {}),
        ...(pollOpts ? { poll: { options: pollOpts, multi: poll.multi, days: poll.days } } : {}),
        ...(redPacket ? { redPacket: { points: Number(redPacket.points) || 0, count: Number(redPacket.count) || 0, blessing: redPacket.blessing } } : {}),
      });
      revokeMediaPreviewUrls(media);
      setContent(''); setMedia([]); setCoverTarget(null); setVis('public'); setFocused(false); setShowLoc(false); setPoll(null); setRedPacket(null);
      clearDraftStore(); setDraftRestored(false);
      if (taRef.current) taRef.current.style.height = 'auto';
      toast.ok('发布成功 🎉');
      onPosted?.(data.post);
    } catch (err: any) { toast.err(err.message); }
    finally { setBusy(false); }
  };

  const resizeTa = (ta: HTMLTextAreaElement) => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; };

  // wrap the current textarea selection with markdown markers (加粗/删除线/代码)
  const format = (mark: string, end: string = mark) => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart ?? content.length;
    const e = ta.selectionEnd ?? content.length;
    const sel = content.slice(s, e) || '文字';
    const next = content.slice(0, s) + mark + sel + end + content.slice(e);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = s + mark.length;
      ta.selectionEnd = s + mark.length + sel.length;
      resizeTa(ta);
    });
  };

  // prepend a block marker (标题 ## / 列表 - / 引用 >) to the start of the current line
  const prefixLine = (prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart ?? content.length;
    const lineStart = content.lastIndexOf('\n', s - 1) + 1;
    const next = content.slice(0, lineStart) + prefix + content.slice(lineStart);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s + prefix.length;
      resizeTa(ta);
    });
  };

  // insert a markdown link [文字](url), cursor landing on the url so it can be typed over
  const insertLink = () => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart ?? content.length;
    const e = ta.selectionEnd ?? content.length;
    const sel = content.slice(s, e) || '链接文字';
    const snippet = `[${sel}](https://)`;
    const next = content.slice(0, s) + snippet + content.slice(e);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = s + sel.length + 3;       // just after "]("
      ta.selectionEnd = s + snippet.length - 1;     // just before ")"
      resizeTa(ta);
    });
  };

  return (
    <div className={embedded ? 'composer composer-embedded' : 'ui-card composer'}>
      <div className="composer-top">
        <Avatar user={user} size={44} />
        <div style={{ flex: 1, position: 'relative' }}>
          {draftRestored && content && (
            <div className="composer-draft-note">
              <span><Icon name="clock" size={13} /> 已恢复上次未发布的草稿</span>
              <button type="button" onClick={clearDraft}>清除</button>
            </div>
          )}
          <textarea
            ref={taRef}
            value={content}
            onChange={grow}
            onKeyDown={onCtrlEnter(submit, mention.onKeyDown)}
            onBlur={() => setTimeout(mention.close, 120)}
            onFocus={() => setFocused(true)}
            placeholder={placeholder || (user ? `${user.nickname}，分享你的新鲜事…（可 @好友、加 #话题#）` : '分享新鲜事…')}
            rows={focused || content ? 2 : 1}
          />
          {mention.dropdown}
          {!!media.length && (
            <div className="composer-preview">
              {media.map((m, i) => (
                <div className={`pv${m.type === 'video' ? ' pv-video' : ''}`} key={i}>
                  {m.type === 'image' ? (
                    <img src={m.url} alt="" />
                  ) : m.type === 'video' ? (
                    <>
                      {m.poster ? <img src={m.poster} alt="" /> : <div className="center" style={{ height: '100%', color: 'var(--ink-3)' }}><Icon name="video" size={26} /></div>}
                      <button type="button" className="pv-cover" onClick={() => setCoverTarget((v) => (v === i ? null : i))}><Icon name="camera" size={13} /> 封面</button>
                    </>
                  ) : (
                    <div className="center" style={{ height: '100%', color: 'var(--ink-3)' }}><Icon name="music" size={26} /></div>
                  )}
                  <button className="rm" onClick={() => {
                    setMedia((a) => {
                      revokePreviewUrl(a[i]?.previewUrl);
                      return a.filter((_, j) => j !== i);
                    });
                    if (coverTarget === i) setCoverTarget(null);
                  }} aria-label="移除"><Icon name="close" size={13} /></button>
                </div>
              ))}
            </div>
          )}
          {coverTarget !== null && media[coverTarget]?.type === 'video' && (
            <div className="video-cover-editor">
              <div className="video-cover-head">
                <span><Icon name="camera" size={15} /> 视频封面</span>
                <button className="faint" style={{ fontSize: 12.5 }} onClick={() => setCoverTarget(null)}>收起</button>
              </div>
              <div className="video-cover-frame">
                <video
                  key={coverVideoSrc}
                  ref={coverVideoRef}
                  src={coverVideoSrc}
                  controls
                  preload="auto"
                  playsInline
                  poster={media[coverTarget].poster || undefined}
                  onLoadStart={() => { setCoverVideoState('loading'); setCoverVideoMessage(''); }}
                  onLoadedData={(e) => markCoverVideoReady(e.currentTarget)}
                  onCanPlay={(e) => markCoverVideoReady(e.currentTarget)}
                  onSeeked={(e) => markCoverVideoReady(e.currentTarget)}
                  onError={(e) => { setCoverVideoState('error'); setCoverVideoMessage(videoLoadErrorMessage(e.currentTarget)); }}
                />
                {coverVideoState === 'loading' && <div className="video-cover-status">正在加载视频画面…</div>}
                {coverVideoState === 'error' && <div className="video-cover-status error">{coverVideoMessage}</div>}
              </div>
              <div className="video-cover-actions">
                <button className="btn btn-primary btn-sm" disabled={coverBusy} onClick={() => captureVideoCover(coverTarget)}>
                  {coverBusy ? '截取中…' : coverVideoState === 'loading' ? '加载视频中…' : '截取当前帧为封面'}
                </button>
                <input className="inp inp-sm" value={media[coverTarget].poster || ''} onChange={(e) => updateMedia(coverTarget, { poster: e.target.value })} placeholder="或粘贴封面图片 URL" />
              </div>
              <div className="video-link-hint">上传到本站的视频通常可直接截取。外链视频如开启跨域限制，请使用封面 URL。</div>
            </div>
          )}
        </div>
      </div>

      {(focused || content || media.length > 0 || poll || redPacket) && (
        <>
          {vis === 'paid' && (
            <div className="row gap-8" style={{ marginTop: 10, fontSize: 13 }}>
              <span className="muted">解锁价格</span>
              <input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)}
                className="inp inp-sm" style={{ width: 96 }} />
              <span className="muted">积分</span>
            </div>
          )}
          {vis === 'password' && (
            <div className="row gap-8" style={{ marginTop: 10, fontSize: 13 }}>
              <span className="muted">访问密码</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="设置查看密码"
                className="inp inp-sm" style={{ width: 170 }} />
            </div>
          )}
          {showLoc && (
            <div className="row gap-8" style={{ marginTop: 10, fontSize: 13 }}>
              <Icon name="location" size={15} style={{ color: 'var(--brand)' }} />
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="所在城市，如：上海" maxLength={20}
                className="inp inp-sm" style={{ width: 210 }} />
              {location && <button className="faint" style={{ fontSize: 12 }} onClick={() => { setLocation(''); setShowLoc(false); }}>清除</button>}
            </div>
          )}
          {videoLinkOpen && !cannotAddVideo && (
            <div className="video-link-editor">
              <div className="video-link-head">
                <span><Icon name="link" size={15} /> 插入视频外链</span>
                <button className="faint" style={{ fontSize: 12.5 }} onClick={() => setVideoLinkOpen(false)}>收起</button>
              </div>
              <div className="video-link-row">
                <input className="inp inp-sm" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://example.com/video.mp4" />
                <button className="btn btn-primary btn-sm" onClick={addVideoLink}>添加</button>
              </div>
              <input className="inp inp-sm" value={videoPosterUrl} onChange={(e) => setVideoPosterUrl(e.target.value)} placeholder="封面图片 URL（选填，https://example.com/cover.jpg）" />
              <div className="video-link-hint">先支持 mp4 / webm / mov / m4v 直链。部分外链会因防盗链或跨域限制无法播放或截封面。</div>
            </div>
          )}
          {poll && (
            <div className="poll-editor">
              <div className="poll-editor-head">
                <span><Icon name="poll" size={15} /> 发起投票</span>
                <button className="faint" style={{ fontSize: 12.5 }} onClick={() => setPoll(null)}>移除</button>
              </div>
              {poll.options.map((opt: any, i: number) => (
                <div className="poll-editor-row" key={i}>
                  <input value={opt} maxLength={60} placeholder={`选项 ${i + 1}`}
                    onChange={(e) => setPoll((p: any) => ({ ...p, options: p.options.map((o: any, j: number) => j === i ? e.target.value : o) }))} />
                  {poll.options.length > 2 && (
                    <button className="poll-editor-rm" title="删除选项"
                      onClick={() => setPoll((p: any) => ({ ...p, options: p.options.filter((_: any, j: number) => j !== i) }))}>
                      <Icon name="close" size={15} />
                    </button>
                  )}
                </div>
              ))}
              <div className="poll-editor-foot">
                {poll.options.length < 6 && (
                  <button className="poll-add" onClick={() => setPoll((p: any) => ({ ...p, options: [...p.options, ''] }))}>
                    <Icon name="plus" size={14} /> 添加选项
                  </button>
                )}
                <div className="spacer" />
                <label className="poll-multi"><input type="checkbox" checked={poll.multi}
                  onChange={(e) => setPoll((p: any) => ({ ...p, multi: e.target.checked }))} /> 多选</label>
                <select className="vis-select" value={poll.days}
                  onChange={(e) => setPoll((p: any) => ({ ...p, days: Number(e.target.value) }))} title="截止时间">
                  <option value={0}>长期</option>
                  <option value={1}>1 天</option>
                  <option value={3}>3 天</option>
                  <option value={7}>7 天</option>
                </select>
              </div>
            </div>
          )}
          {redPacket && (
            <div className="rp-editor">
              <div className="rp-editor-head">
                <span><Icon name="redpacket" size={15} /> 积分红包</span>
                <button className="faint" style={{ fontSize: 12.5 }} onClick={() => setRedPacket(null)}>移除</button>
              </div>
              <div className="rp-editor-row">
                <label className="rp-ef"><span>总积分</span>
                  <input type="number" min={1} value={redPacket.points} onChange={(e) => setRedPacket((r: any) => ({ ...r, points: e.target.value }))} className="inp inp-sm" /></label>
                <label className="rp-ef"><span>红包个数</span>
                  <input type="number" min={1} max={100} value={redPacket.count} onChange={(e) => setRedPacket((r: any) => ({ ...r, count: e.target.value }))} className="inp inp-sm" /></label>
              </div>
              <input className="inp inp-sm rp-ef-bless" maxLength={30} placeholder="祝福语（选填）" value={redPacket.blessing}
                onChange={(e) => setRedPacket((r: any) => ({ ...r, blessing: e.target.value }))} />
              <div className="rp-editor-hint">
                {Number(redPacket.count) > 0 && `${redPacket.count} 个红包随机分配 ${Number(redPacket.points) || 0} 积分，先到先得 · `}
                你当前 {user?.points ?? 0} 积分
              </div>
            </div>
          )}
          <div className="composer-bar">
            <button className="tool" disabled={hasVideoMedia} onClick={() => imageFileRef.current?.click()} title={hasVideoMedia ? videoExclusiveMessage : '图片'}><Icon name="image" size={19} /></button>
            <button className="tool" disabled={cannotAddVideo} onClick={() => videoFileRef.current?.click()} title={cannotAddVideo ? '已有图片、音频、投票或红包时不能添加视频' : '视频'}><Icon name="video" size={19} /></button>
            <button className={`tool${videoLinkOpen ? ' on' : ''}`} disabled={cannotAddVideo} onClick={() => setVideoLinkOpen((s) => !s)} title={cannotAddVideo ? '已有图片、音频、投票或红包时不能添加视频外链' : '视频外链'} style={videoLinkOpen ? { color: 'var(--brand)' } : undefined}><Icon name="link" size={18} /></button>
            <button className={`tool${poll ? ' on' : ''}`} title={hasVideoMedia ? videoExclusiveMessage : '投票'} style={poll ? { color: 'var(--brand)' } : undefined}
              disabled={hasVideoMedia}
              onClick={() => setPoll((p: any) => p ? null : { options: ['', ''], multi: false, days: 0 })}><Icon name="poll" size={19} /></button>
            <button className={`tool${redPacket ? ' on' : ''}`} title={hasVideoMedia ? videoExclusiveMessage : '积分红包'} style={redPacket ? { color: 'var(--gold-deep)' } : undefined}
              disabled={hasVideoMedia}
              onClick={() => setRedPacket((r: any) => r ? null : { points: 88, count: 8, blessing: '恭喜发财 大吉大利' })}><Icon name="redpacket" size={19} /></button>
            <div style={{ position: 'relative' }}>
              <button className="tool" onClick={() => setShowEmoji((s) => !s)} title="表情"><Icon name="smile" size={19} /></button>
              {showEmoji && (
                <div className="emoji-pop">
                  {EMOJIS.map((em) => <button key={em} onClick={() => insertEmoji(em)}>{em}</button>)}
                </div>
              )}
            </div>
            <button className={`tool${showLoc && location ? ' on' : ''}`} onClick={() => setShowLoc((s) => !s)} title="所在位置" style={showLoc && location ? { color: 'var(--brand)' } : undefined}><Icon name="location" size={19} /></button>
            <select className="vis-select" value={vis} onChange={(e) => setVis(e.target.value)} title="可见范围">
              {Object.entries(VIS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{(v as any).label}</option>
              ))}
            </select>
            <div className="composer-submit">
              {savedHint && <span className="composer-saved"><Icon name="check" size={11} /> 已存草稿</span>}
              <span className="faint num" style={{ fontSize: 12 }}>{content.length}/1000</span>
              <button className="btn btn-primary" disabled={busy || (!content.trim() && !media.length && !poll && !redPacket)} onClick={submit}>
                {busy ? '发布中…' : '发布'}
              </button>
            </div>
          </div>
        </>
      )}
      <input ref={imageFileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e, 'image')} />
      <input ref={videoFileRef} type="file" accept="video/*" hidden onChange={(e) => upload(e, 'video')} />
    </div>
  );
}
