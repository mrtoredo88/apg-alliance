import React, { useEffect, useState } from 'react';
import { APP_LOCK_HINT_KEY, authenticateNativeUser, getNativeSecurityStatus, nativeSecuritySupported } from '../platform/nativeSecurity.js';

const lockRequested = () => {
  try { return localStorage.getItem(APP_LOCK_HINT_KEY) === '1'; } catch { return false; }
};

export function NativeSecurityGate({ children }) {
  const [state, setState] = useState(() => nativeSecuritySupported() && lockRequested() ? 'checking' : 'open');

  const unlock = async () => {
    setState('checking');
    try {
      const status = await getNativeSecurityStatus();
      if (!status.enabled) {
        setState('open');
        return;
      }
      await authenticateNativeUser('Разблокируйте приложение');
      setState('open');
    } catch {
      setState('locked');
    }
  };

  useEffect(() => {
    if (nativeSecuritySupported() && lockRequested()) unlock();
  }, []);

  if (state === 'open') return children;

  return (
    <main style={{ minHeight: '100dvh', background: '#090413', color: '#fff', display: 'grid', placeItems: 'center', padding: 28, textAlign: 'center' }}>
      <div>
        <div style={{ width: 72, height: 72, borderRadius: 22, margin: '0 auto 20px', display: 'grid', placeItems: 'center', background: '#000', color: '#c9a84c', fontSize: 24, fontWeight: 900 }}>АПГ</div>
        <h1 style={{ margin: '0 0 10px', fontSize: 24 }}>Приложение защищено</h1>
        <p style={{ margin: '0 0 22px', color: 'rgba(255,255,255,.64)' }}>Используйте биометрию или код блокировки устройства.</p>
        {state === 'locked' && (
          <button onClick={unlock} style={{ border: 0, borderRadius: 14, padding: '13px 22px', background: '#c9a84c', color: '#10091a', fontWeight: 800, fontSize: 15 }}>Разблокировать</button>
        )}
      </div>
    </main>
  );
}
