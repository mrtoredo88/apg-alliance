import React, { useEffect, useState } from 'react';
import { ANDROID_LANDING_URL } from '../constants.js';
import { checkAndroidUpdate } from '../platform/androidUpdate.js';
import { openExternalUrl } from '../platform/externalLinks.js';
import {
  addNativeUpdateProgressListener,
  downloadAndInstallAndroidUpdate,
} from '../platform/nativeUpdater.js';

const DISMISSED_KEY = 'apg_android_update_dismissed';

export function AndroidUpdateBanner() {
  const [update, setUpdate] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let progressHandle;
    void addNativeUpdateProgressListener(event => {
      if (active) setProgress(Number(event?.percent || 0));
    }).then(handle => { progressHandle = handle; }).catch(() => {});
    void checkAndroidUpdate()
      .then(result => {
        if (!active || !result?.available) return;
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (!result.required && dismissed === String(result.latestVersionCode)) return;
        setUpdate(result);
      })
      .catch(() => {});
    return () => {
      active = false;
      void progressHandle?.remove();
    };
  }, []);

  if (!update) return null;
  const version = update.release?.versionName || update.latestVersionCode;

  const dismiss = () => {
    if (update.required) return;
    localStorage.setItem(DISMISSED_KEY, String(update.latestVersionCode));
    setUpdate(null);
  };
  const notes = Array.isArray(update.release?.releaseNotes) ? update.release.releaseNotes.slice(0, 3) : [];
  const sizeMb = Number(update.release?.sizeBytes || 0) > 0
    ? `${(Number(update.release.sizeBytes) / 1024 / 1024).toFixed(1)} МБ`
    : '';

  const install = async () => {
    setError('');
    setProgress(0);
    setStatus('downloading');
    try {
      const result = await downloadAndInstallAndroidUpdate(update.release);
      if (result?.needsInstallPermission) {
        setStatus('permission');
      } else {
        setStatus('installer');
      }
    } catch {
      setError('Не удалось загрузить обновление. Проверьте интернет и попробуйте ещё раз.');
      setStatus('error');
    }
  };

  return (
    <div data-android-update-banner style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))', zIndex: 12400, maxWidth: 520, margin: '0 auto', borderRadius: 22, padding: 14, color: '#17120a', background: 'linear-gradient(135deg,#f4d77f,#c9a84c)', boxShadow: '0 18px 55px rgba(38,28,8,0.32)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span aria-hidden="true" style={{ fontSize: 25 }}>⬆️</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: 'block', fontSize: 15 }}>Доступна версия {version}</strong>
          <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, lineHeight: '17px', opacity: 0.78 }}>
            {update.required ? 'Обновление необходимо для продолжения работы.' : 'Обновите АПГ, чтобы получить исправления и новые возможности.'}
          </span>
        </span>
        {!update.required && <button type="button" onClick={dismiss} aria-label="Напомнить позже" style={{ border: 0, background: 'transparent', color: '#17120a', fontSize: 22, cursor: 'pointer' }}>×</button>}
      </div>
      {notes.length > 0 && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 22, fontSize: 12, lineHeight: '17px' }}>
          {notes.map(note => <li key={note}>{note}</li>)}
        </ul>
      )}
      {status === 'downloading' && (
        <div style={{ marginTop: 11 }}>
          <div style={{ height: 7, overflow: 'hidden', borderRadius: 9, background: 'rgba(23,18,10,.18)' }}>
            <div style={{ height: '100%', width: `${progress}%`, borderRadius: 9, background: '#17120a', transition: 'width .25s ease' }} />
          </div>
          <div style={{ marginTop: 5, fontSize: 12, textAlign: 'center' }}>Загрузка: {progress}%</div>
        </div>
      )}
      {status === 'permission' && <div style={{ marginTop: 9, fontSize: 12, lineHeight: '17px' }}>Разрешите установку обновлений для АПГ в открывшихся настройках, затем нажмите кнопку ещё раз.</div>}
      {status === 'installer' && <div style={{ marginTop: 9, fontSize: 12, lineHeight: '17px' }}>Подтвердите обновление в системном окне Android.</div>}
      {error && <div role="alert" style={{ marginTop: 9, fontSize: 12, lineHeight: '17px', color: '#7d1b15' }}>{error}</div>}
      <button type="button" disabled={status === 'downloading'} onClick={() => { void install(); }} style={{ width: '100%', minHeight: 44, marginTop: 11, border: 0, borderRadius: 15, background: '#17120a', color: '#fff8e6', fontSize: 14, fontWeight: 850, cursor: status === 'downloading' ? 'wait' : 'pointer', opacity: status === 'downloading' ? 0.72 : 1 }}>
        {status === 'downloading' ? `Загружаем ${progress}%` : `Скачать и обновить${sizeMb ? ` · ${sizeMb}` : ''}`}
      </button>
      <button type="button" onClick={() => { void openExternalUrl(update.release?.landingUrl || ANDROID_LANDING_URL); }} style={{ width: '100%', minHeight: 34, marginTop: 4, border: 0, background: 'transparent', color: '#17120a', fontSize: 12, fontWeight: 750, cursor: 'pointer' }}>Проблемы с обновлением?</button>
    </div>
  );
}
