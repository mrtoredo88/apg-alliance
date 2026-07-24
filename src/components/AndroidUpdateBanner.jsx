import React, { useEffect, useState } from 'react';
import { ANDROID_LANDING_URL } from '../constants.js';
import { checkAndroidUpdate } from '../platform/androidUpdate.js';
import { openExternalUrl } from '../platform/externalLinks.js';

const DISMISSED_KEY = 'apg_android_update_dismissed';

export function AndroidUpdateBanner() {
  const [update, setUpdate] = useState(null);

  useEffect(() => {
    let active = true;
    void checkAndroidUpdate()
      .then(result => {
        if (!active || !result?.available) return;
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (!result.required && dismissed === String(result.latestVersionCode)) return;
        setUpdate(result);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (!update) return null;
  const version = update.release?.versionName || update.latestVersionCode;

  const dismiss = () => {
    if (update.required) return;
    localStorage.setItem(DISMISSED_KEY, String(update.latestVersionCode));
    setUpdate(null);
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
      <button type="button" onClick={() => { void openExternalUrl(update.release?.landingUrl || ANDROID_LANDING_URL); }} style={{ width: '100%', minHeight: 44, marginTop: 11, border: 0, borderRadius: 15, background: '#17120a', color: '#fff8e6', fontSize: 14, fontWeight: 850, cursor: 'pointer' }}>
        Открыть страницу обновления
      </button>
    </div>
  );
}
