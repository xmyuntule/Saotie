// Structured composer draft persisted in localStorage so an unsent post (text + images + poll +
// visibility + location) survives navigation / reload / accidental close. Older drafts were a plain
// text string — loadDraft() still reads those for backward compatibility.

export interface Draft {
  content?: string;
  media?: any[];
  vis?: string;
  poll?: any;
  location?: string;
}

const KEY = 'haha_draft';

function nonEmpty(d: Draft | null): boolean {
  return !!(d && (d.content?.trim() || (d.media && d.media.length) || d.poll));
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    if (raw[0] !== '{') return { content: raw }; // legacy plain-text draft
    return JSON.parse(raw);
  } catch { return null; }
}

// Persist the draft; removes it when there's nothing worth keeping. Returns true if something was saved.
export function saveDraft(d: Draft): boolean {
  try {
    if (!nonEmpty(d)) { localStorage.removeItem(KEY); return false; }
    localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch { return false; }
}

export function clearDraft(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function hasDraft(): boolean {
  return nonEmpty(loadDraft());
}
