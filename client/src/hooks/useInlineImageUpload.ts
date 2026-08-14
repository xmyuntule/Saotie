import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type RefObject } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';

interface InlineImageUploadOptions {
  taRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  purpose?: string;
  maxFiles?: number;
  alt?: string;
  afterInsert?: (ta: HTMLTextAreaElement | null) => void;
}

type TextSelection = { start: number; end: number };

function imageFiles(files: FileList | File[], maxFiles: number) {
  return Array.from(files).filter((file) => file.type.startsWith('image/')).slice(0, maxFiles);
}

export function useInlineImageUpload({
  taRef,
  value,
  onChange,
  purpose = 'generic',
  maxFiles = 9,
  alt = '图片',
  afterInsert,
}: InlineImageUploadOptions) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef(value);
  const selectionRef = useRef<TextSelection | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const captureSelection = useCallback(() => {
    const ta = taRef.current;
    const current = valueRef.current || '';
    selectionRef.current = ta
      ? { start: ta.selectionStart ?? current.length, end: ta.selectionEnd ?? current.length }
      : { start: current.length, end: current.length };
  }, [taRef]);

  const insertImages = useCallback((urls: string[]) => {
    if (!urls.length) return;
    const current = valueRef.current || '';
    const ta = taRef.current;
    const selection = selectionRef.current || (ta
      ? { start: ta.selectionStart ?? current.length, end: ta.selectionEnd ?? current.length }
      : { start: current.length, end: current.length });
    const start = Math.max(0, Math.min(selection.start, current.length));
    const end = Math.max(start, Math.min(selection.end, current.length));
    const before = current.slice(0, start);
    const after = current.slice(end);
    const blocks = urls.map((url) => `![${alt}](${url})`).join('\n');
    const lead = before && !before.endsWith('\n') ? '\n' : '';
    const tail = after ? (after.startsWith('\n') ? '' : '\n') : '\n';
    const snippet = `${lead}${blocks}${tail}`;
    const next = `${before}${snippet}${after}`;
    const caret = before.length + snippet.length;
    valueRef.current = next;
    selectionRef.current = { start: caret, end: caret };
    onChange(next);
    requestAnimationFrame(() => {
      const nextTa = taRef.current;
      if (!nextTa) return;
      nextTa.focus();
      nextTa.selectionStart = nextTa.selectionEnd = caret;
      afterInsert?.(nextTa);
    });
  }, [afterInsert, alt, onChange, taRef]);

  const uploadFiles = useCallback(async (rawFiles: FileList | File[]) => {
    const files = imageFiles(rawFiles, maxFiles);
    if (!files.length) return;
    const fd = new FormData();
    fd.append('purpose', purpose);
    files.forEach((file) => fd.append('files', file));
    setUploading(true);
    try {
      const { data } = await api.post('/upload', fd);
      const urls = (data.files || [])
        .filter((item: any) => item?.type === 'image' && item?.url)
        .map((item: any) => item.url);
      if (!urls.length) return toast.err('没有可插入的图片');
      insertImages(urls);
    } catch (err: any) {
      toast.err(err?.message || '图片上传失败');
    } finally {
      setUploading(false);
    }
  }, [insertImages, maxFiles, purpose, toast]);

  const open = useCallback(() => {
    if (uploading) return;
    captureSelection();
    inputRef.current?.click();
  }, [captureSelection, uploading]);

  const onInputChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) await uploadFiles(files);
    event.target.value = '';
  }, [uploadFiles]);

  const onPaste = useCallback((event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = imageFiles(event.clipboardData.files, maxFiles);
    if (!files.length) return;
    event.preventDefault();
    captureSelection();
    void uploadFiles(files);
  }, [captureSelection, maxFiles, uploadFiles]);

  const onDrop = useCallback((event: DragEvent<HTMLTextAreaElement>) => {
    const files = imageFiles(event.dataTransfer.files, maxFiles);
    if (!files.length) return;
    event.preventDefault();
    captureSelection();
    void uploadFiles(files);
  }, [captureSelection, maxFiles, uploadFiles]);

  const onDragOver = useCallback((event: DragEvent<HTMLTextAreaElement>) => {
    if (Array.from(event.dataTransfer.types || []).includes('Files') || imageFiles(event.dataTransfer.files, 1).length) {
      event.preventDefault();
    }
  }, []);

  return { inputRef, uploading, open, onInputChange, onPaste, onDrop, onDragOver };
}
