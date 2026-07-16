import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { userAction } from '../userApi.js';
import {
  buildChangedPatch,
  findAutosaveConflictFields,
  hasChangedFields,
  shouldOfferDraftRecovery,
} from '../../server-shared/profile-autosave.js';

function readDraft(key) {
  if (!key || typeof localStorage === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function writeDraft(key, value) {
  if (!key || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function clearDraft(key) {
  if (!key || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function useProfileAutosave({
  id,
  collectionName,
  action,
  data,
  profile,
  selectData,
  validate,
  onApplyDraft,
  onSaved,
  onToast,
  debounceMs = 2000,
}) {
  const draftKey = id ? `apg_profile_autosave_${collectionName}_${id}` : '';
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState(null);
  const [conflictFields, setConflictFields] = useState([]);
  const [savedPulse, setSavedPulse] = useState(false);
  const baseDataRef = useRef({});
  const dataRef = useRef(data || {});
  const stateRef = useRef(state);
  const skipConflictRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => { dataRef.current = data || {}; }, [data]);
  useEffect(() => { stateRef.current = state; }, [state]);

  const dirty = hasChangedFields(data || {}, baseDataRef.current || {});
  const hasUnsaved = dirty || ['dirty', 'error', 'offline', 'conflict', 'recovered'].includes(state);

  useEffect(() => {
    if (!id || !collectionName) return;
    const base = selectData(profile || {});
    baseDataRef.current = base;
    initializedRef.current = true;
    setConflictFields([]);
    setSavedPulse(false);
    const stored = readDraft(draftKey);
    if (shouldOfferDraftRecovery({ draftUpdatedAt: stored?.updatedAt, serverProfile: profile, draftData: stored?.data, serverData: base })) {
      setRecovery(stored);
      setState('recovered');
      setMessage('Найден локальный черновик новее серверной версии.');
    } else {
      setRecovery(null);
      if (stored?.data && !hasChangedFields(stored.data, base)) clearDraft(draftKey);
      setState('saved');
      setMessage('Все изменения сохранены');
    }
  }, [id, collectionName, draftKey, profile, selectData]);

  const persistDraft = useCallback((nextData, reason = 'local') => {
    if (!draftKey) return;
    writeDraft(draftKey, {
      data: nextData,
      base: baseDataRef.current,
      reason,
      updatedAt: Date.now(),
    });
  }, [draftKey]);

  const saveNow = useCallback(async ({ force = false, silent = false } = {}) => {
    if (!id || !action || !collectionName || !initializedRef.current) return false;
    if (recovery && !force) return false;
    const nextData = dataRef.current || {};
    const error = validate?.(nextData);
    if (error) {
      setState('error');
      setMessage(error);
      persistDraft(nextData, 'validation');
      if (!silent) onToast?.(error, 'error');
      return false;
    }
    const patch = buildChangedPatch(nextData, baseDataRef.current || {});
    if (!Object.keys(patch).length) {
      clearDraft(draftKey);
      setState('saved');
      setMessage('Все изменения сохранены');
      return true;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      persistDraft(nextData, 'offline');
      setState('offline');
      setMessage('Нет соединения. Черновик сохранён на устройстве.');
      return false;
    }
    setState('saving');
    setMessage('Выполняется сохранение...');
    try {
      if (!force && !skipConflictRef.current) {
        const snap = await getDoc(doc(db, collectionName, id));
        if (snap.exists()) {
          const serverProfile = { id: snap.id, ...snap.data() };
          const serverData = selectData(serverProfile);
          const conflicts = findAutosaveConflictFields({ base: baseDataRef.current || {}, server: serverData, next: nextData });
          if (conflicts.length) {
            persistDraft(nextData, 'conflict');
            setConflictFields(conflicts);
            setState('conflict');
            setMessage('Профиль изменён на другом устройстве.');
            return false;
          }
        }
      }
      skipConflictRef.current = false;
      await userAction(action, { id, patch });
      const updated = { ...(profile || {}), ...patch };
      baseDataRef.current = { ...(baseDataRef.current || {}), ...patch };
      clearDraft(draftKey);
      setConflictFields([]);
      setRecovery(null);
      setState('saved');
      setMessage('Все изменения сохранены');
      setSavedPulse(true);
      setTimeout(() => setSavedPulse(false), 2400);
      onSaved?.(updated, patch);
      return true;
    } catch (error) {
      persistDraft(nextData, 'error');
      setState(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error');
      setMessage(error?.message || 'Ошибка сохранения. Черновик сохранён на устройстве.');
      if (!silent) onToast?.(error?.message || 'Ошибка сохранения. Попробуйте ещё раз.', 'error');
      return false;
    }
  }, [action, collectionName, draftKey, id, onSaved, onToast, persistDraft, profile, recovery, selectData, validate]);

  useEffect(() => {
    if (!id || recovery || !initializedRef.current) return undefined;
    if (!dirty) return undefined;
    persistDraft(data || {}, 'dirty');
    setState(prev => prev === 'saving' ? prev : 'dirty');
    setMessage('Есть несохранённые изменения');
    const timer = setTimeout(() => saveNow({ silent: true }), debounceMs);
    return () => clearTimeout(timer);
  }, [data, debounceMs, dirty, id, persistDraft, recovery, saveNow]);

  useEffect(() => {
    const onOnline = () => {
      if (['offline', 'error', 'dirty'].includes(stateRef.current)) saveNow({ silent: true });
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [saveNow]);

  useEffect(() => {
    const onBeforeUnload = event => {
      if (!hasUnsaved) return undefined;
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsaved]);

  const restoreDraft = useCallback(() => {
    if (!recovery?.data) return;
    onApplyDraft?.(recovery.data);
    setRecovery(null);
    setState('dirty');
    setMessage('Есть несохранённые изменения');
    persistDraft(recovery.data, 'restored');
  }, [onApplyDraft, persistDraft, recovery]);

  const discardDraft = useCallback(() => {
    clearDraft(draftKey);
    setRecovery(null);
    setConflictFields([]);
    setState('saved');
    setMessage('Все изменения сохранены');
  }, [draftKey]);

  const keepLocalChanges = useCallback(() => {
    skipConflictRef.current = true;
    setConflictFields([]);
    setState('dirty');
    setMessage('Есть несохранённые изменения');
    saveNow({ force: true });
  }, [saveNow]);

  const reloadServer = useCallback(async () => {
    if (!id || !collectionName) return;
    const snap = await getDoc(doc(db, collectionName, id));
    if (!snap.exists()) return;
    const serverProfile = { id: snap.id, ...snap.data() };
    const serverData = selectData(serverProfile);
    baseDataRef.current = serverData;
    onApplyDraft?.(serverData);
    onSaved?.(serverProfile, {});
    clearDraft(draftKey);
    setRecovery(null);
    setConflictFields([]);
    setState('saved');
    setMessage('Все изменения сохранены');
  }, [collectionName, draftKey, id, onApplyDraft, onSaved, selectData]);

  return {
    state,
    message,
    dirty,
    hasUnsaved,
    recovery,
    conflictFields,
    savedPulse,
    saveNow,
    restoreDraft,
    discardDraft,
    keepLocalChanges,
    reloadServer,
  };
}
