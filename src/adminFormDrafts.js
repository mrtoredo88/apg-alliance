import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'apg_admin_draft_';
const AUTOSAVE_INTERVAL_MS = 12000;
const DEBOUNCE_MS = 2500;

export function readAdminDraft(formKey) {
  try {
    const raw = localStorage.getItem(PREFIX + formKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data && typeof parsed.data === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearAdminDraft(formKey) {
  try { localStorage.removeItem(PREFIX + formKey); } catch {}
}

function writeAdminDraft(formKey, editingId, data) {
  localStorage.setItem(PREFIX + formKey, JSON.stringify({
    savedAt: Date.now(),
    editingId: editingId || '',
    data,
  }));
}

export function formatDraftTime(savedAt) {
  if (!savedAt) return '';
  return new Date(savedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// data — плоский снимок полей формы; onRestore(data) раскладывает его обратно в стейты
export function useAdminFormDraft({ formKey, enabled, editingId = '', data, isEmpty = false }) {
  const [status, setStatus] = useState('idle');
  const [savedAt, setSavedAt] = useState(0);
  const [pendingDraft, setPendingDraft] = useState(null);

  const dataRef = useRef(data);
  dataRef.current = data;
  const editingIdRef = useRef(editingId);
  editingIdRef.current = editingId || '';
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const isEmptyRef = useRef(isEmpty);
  isEmptyRef.current = isEmpty;
  const lastSavedRef = useRef('');
  const debounceRef = useRef(null);
  const wasEnabledRef = useRef(false);

  const saveNow = useCallback(() => {
    if (!enabledRef.current || isEmptyRef.current) return;
    const serialized = JSON.stringify(dataRef.current);
    if (serialized === lastSavedRef.current) return;
    setStatus('saving');
    try {
      writeAdminDraft(formKey, editingIdRef.current, dataRef.current);
      lastSavedRef.current = serialized;
      setSavedAt(Date.now());
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, [formKey]);

  const discardDraft = useCallback(() => {
    clearAdminDraft(formKey);
    lastSavedRef.current = '';
    setPendingDraft(null);
    setStatus('idle');
    setSavedAt(0);
  }, [formKey]);

  const acceptDraft = useCallback(() => {
    setPendingDraft(null);
  }, []);

  useEffect(() => {
    if (enabled && !wasEnabledRef.current) {
      const draft = readAdminDraft(formKey);
      if (draft && (draft.editingId || '') === (editingId || '') && JSON.stringify(draft.data) !== JSON.stringify(dataRef.current)) {
        setPendingDraft(draft);
      } else {
        setPendingDraft(null);
      }
      setStatus('idle');
    }
    if (!enabled && wasEnabledRef.current) setPendingDraft(null);
    wasEnabledRef.current = enabled;
  }, [enabled, editingId, formKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(saveNow, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [enabled, JSON.stringify(data), saveNow]);

  useEffect(() => {
    if (!enabled) return undefined;
    const interval = setInterval(saveNow, AUTOSAVE_INTERVAL_MS);
    const flush = () => saveNow();
    const onVisibility = () => { if (document.visibilityState === 'hidden') saveNow(); };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      saveNow();
    };
  }, [enabled, saveNow]);

  return { status, savedAt, pendingDraft, acceptDraft, discardDraft, saveNow, clear: discardDraft };
}
