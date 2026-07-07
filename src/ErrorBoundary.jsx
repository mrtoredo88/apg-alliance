import React from 'react';
import { logError } from './errorLogger.js';
import { LOKI_EVENTS } from './loki/lokiEvents.js';
import { showLokiMessage } from './loki/lokiBus.js';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, errorId: null };
  }

  static getDerivedStateFromError(error) {
    return { error, errorId: `APG-${Date.now().toString(36).toUpperCase()}` };
  }

  componentDidCatch(error, info) {
    const source = 'ErrorBoundary:' + (info.componentStack ?? '').slice(0, 220);
    this.setState({ info });
    try {
      const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
      sessionStorage.setItem('apg_last_startup_error', JSON.stringify({
        at: new Date().toISOString(),
        id: this.state.errorId,
        message: error?.message ?? String(error),
        stack: String(error?.stack ?? '').slice(0, 2400),
        componentStack: String(info?.componentStack ?? '').slice(0, 1600),
        url: window.location.href,
        route: window.location.hash || window.location.pathname,
        standalone,
        userAgent: navigator.userAgent,
      }));
    } catch {}
    logError(error, source);
    try { showLokiMessage(LOKI_EVENTS.APP_ERROR, { source: 'error_boundary' }); } catch {}
  }

  async clearCacheAndReload() {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(reg => reg.unregister().catch(() => {})));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
      localStorage.removeItem('apg_build');
    } catch {}
    window.location.reload();
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message ?? String(this.state.error);
      const componentLine = String(this.state.info?.componentStack ?? '').trim().split('\n')[0] ?? '';
      return (
        <div style={{
          minHeight: '100vh',
          background: '#08081A',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ color: '#F0F0F0', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Что-то пошло не так
          </div>
          <div style={{ color: 'rgba(240,240,240,0.45)', fontSize: 14, marginBottom: 32, lineHeight: '20px' }}>
            Мы сохранили диагностику ошибки запуска. Попробуйте восстановить приложение.
          </div>
          <div style={{
            width: '100%',
            maxWidth: 420,
            boxSizing: 'border-box',
            marginBottom: 18,
            padding: 12,
            borderRadius: 14,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(240,240,240,0.72)',
            fontSize: 11,
            lineHeight: '16px',
            textAlign: 'left',
            overflowWrap: 'anywhere',
          }}>
            <div style={{ color: '#E8C97A', fontWeight: 800, marginBottom: 5 }}>{this.state.errorId}</div>
            <div>{message}</div>
            {componentLine && <div style={{ marginTop: 6, color: 'rgba(240,240,240,0.42)' }}>{componentLine}</div>}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
              border: 'none', borderRadius: 14,
              color: '#0F0F1A', fontSize: 15, fontWeight: 700,
              padding: '14px 32px', cursor: 'pointer',
            }}
          >
            Перезагрузить
          </button>
          <button
            onClick={() => this.clearCacheAndReload()}
            style={{
              marginTop: 10,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 14,
              color: '#F0F0F0', fontSize: 14, fontWeight: 700,
              padding: '12px 22px', cursor: 'pointer',
            }}
          >
            Очистить кэш и перезапустить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
