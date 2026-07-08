import React, { useEffect, useMemo, useState } from 'react';
import { T, GLASS, GLASS_STRONG } from './design.js';
import {
  getNetworkLogs,
  getRuntimeNetworkInfo,
  NETWORK_DIAGNOSTIC_TARGETS,
  runNetworkDiagnostics,
} from './networkDiagnostics.js';

function statusColor(result) {
  if (!result) return T.textSec;
  if (result.ok) return T.green;
  return result.required ? T.red : T.gold;
}

function statusText(result) {
  if (!result) return 'Ожидает проверки';
  if (result.ok) return 'Доступен';
  if (result.errorName === 'AbortError') return 'Таймаут';
  return result.required ? 'Недоступен' : 'Проблема доступа';
}

function NetworkCard({ target, result }) {
  const color = statusColor(result);
  return (
    <div style={{ ...GLASS, borderRadius: 18, padding: 16, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: T.textPri, fontSize: 16, fontWeight: 850 }}>{target.title}</div>
          <div style={{ color: T.textSec, fontSize: 12, marginTop: 4, wordBreak: 'break-all' }}>{target.url}</div>
        </div>
        <div style={{
          flexShrink: 0,
          color,
          border: `1px solid ${color}`,
          borderRadius: 999,
          padding: '6px 10px',
          fontSize: 12,
          fontWeight: 850,
          background: result?.ok ? 'rgba(75,179,75,0.12)' : 'rgba(230,70,70,0.10)',
        }}>
          {statusText(result)}
        </div>
      </div>
      {result && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={pillStyle}>status: {result.status}</span>
          <span style={pillStyle}>{result.durationMs} ms</span>
          <span style={pillStyle}>mode: {target.mode}</span>
          <span style={pillStyle}>{target.required ? 'critical' : 'optional'}</span>
        </div>
      )}
      {result && !result.ok && (
        <div style={{ color: T.red, fontSize: 13, lineHeight: 1.45 }}>
          {result.errorName ? `${result.errorName}: ` : ''}{result.errorMessage || 'Запрос не выполнился'}
        </div>
      )}
      <div style={{ color: T.textSec, fontSize: 13, lineHeight: 1.45 }}>{target.recommendation}</div>
    </div>
  );
}

const pillStyle = {
  color: T.textSec,
  border: `1px solid ${T.border}`,
  borderRadius: 999,
  padding: '5px 8px',
  fontSize: 12,
  background: 'rgba(255,255,255,0.05)',
};

export function NetworkDiagnosticsPage() {
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState(() => getNetworkLogs());
  const runtime = useMemo(() => getRuntimeNetworkInfo(), []);
  const version = useMemo(() => localStorage.getItem('apg_build') || '?', []);

  const runChecks = async () => {
    setRunning(true);
    setResults([]);
    try {
      await runNetworkDiagnostics((_, partial) => setResults(partial));
    } finally {
      setRunning(false);
      setLogs(getNetworkLogs());
    }
  };

  useEffect(() => {
    const onLog = () => setLogs(getNetworkLogs());
    window.addEventListener('apg:network-log', onLog);
    runChecks();
    return () => window.removeEventListener('apg:network-log', onLog);
  }, []);

  const byId = useMemo(() => new Map(results.map(item => [item.id, item])), [results]);
  const failedRequired = results.filter(item => item.required && !item.ok);
  const failedFirebase = results.filter(item => item.id.includes('firebase') || item.id === 'firestore' || item.id === 'gstatic').filter(item => !item.ok);
  const apiOk = byId.get('api')?.ok && byId.get('public-data')?.ok;

  return (
    <div style={{
      minHeight: '100svh',
      background: APG_BG,
      color: T.textPri,
      padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 16px calc(env(safe-area-inset-bottom, 0px) + 28px)',
      boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ ...GLASS_STRONG, borderRadius: 22, padding: 18 }}>
          <div style={{ color: T.gold, fontSize: 12, fontWeight: 900, letterSpacing: 0, textTransform: 'uppercase' }}>APG Network Diagnostics</div>
          <h1 style={{ margin: '8px 0 8px', fontSize: 28, lineHeight: 1.12 }}>Диагностика сети</h1>
          <div style={{ color: T.textSec, fontSize: 14, lineHeight: 1.5 }}>
            Откройте эту страницу на телефоне без VPN. Если `myapg.ru` и Yandex API доступны, а Firebase/Google недоступны, причина в блокировке внешней Firebase-инфраструктуры на сети пользователя.
          </div>
          <button
            type="button"
            onClick={runChecks}
            disabled={running}
            style={{
              marginTop: 16,
              width: '100%',
              border: 'none',
              borderRadius: 14,
              padding: '13px 16px',
              color: '#111',
              background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
              fontSize: 15,
              fontWeight: 900,
              opacity: running ? 0.72 : 1,
            }}
          >
            {running ? 'Проверяем...' : 'Проверить ещё раз'}
          </button>
        </div>

        <div style={{ ...GLASS, borderRadius: 18, padding: 16 }}>
          <div style={{ color: T.textPri, fontSize: 16, fontWeight: 850, marginBottom: 10 }}>Устройство и окружение</div>
          <div style={{ display: 'grid', gap: 8, color: T.textSec, fontSize: 13, lineHeight: 1.45 }}>
            <div>online: {String(runtime.online)}</div>
            <div>PWA standalone: {String(runtime.standalone)}</div>
            <div>route: {runtime.route}</div>
            <div>version: {version}</div>
            <div>connection: {runtime.connection ? JSON.stringify(runtime.connection) : 'n/a'}</div>
            <div style={{ wordBreak: 'break-word' }}>UA: {runtime.userAgent}</div>
          </div>
        </div>

        {(failedRequired.length > 0 || failedFirebase.length > 0) && (
          <div style={{ ...GLASS, borderRadius: 18, padding: 16, borderColor: failedRequired.length ? 'rgba(230,70,70,0.45)' : 'rgba(201,168,76,0.45)' }}>
            <div style={{ color: failedRequired.length ? T.red : T.gold, fontSize: 16, fontWeight: 900, marginBottom: 8 }}>
              {failedRequired.length ? 'Критичный сервис недоступен' : 'Есть риск VPN-зависимости'}
            </div>
            <div style={{ color: T.textSec, fontSize: 14, lineHeight: 1.55 }}>
              {apiOk && failedFirebase.length > 0
                ? 'Yandex API работает, но Firebase/Google недоступны. Значит приложение должно убирать прямые Firebase-запросы из критичного пути и вести публичные данные через backend.'
                : 'Смотрите карточки ниже: первая красная критичная проверка обычно показывает точку отказа.'}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          {NETWORK_DIAGNOSTIC_TARGETS.map(target => (
            <NetworkCard key={target.id} target={target} result={byId.get(target.id)} />
          ))}
        </div>

        <div style={{ ...GLASS, borderRadius: 18, padding: 16 }}>
          <div style={{ color: T.textPri, fontSize: 16, fontWeight: 850, marginBottom: 10 }}>Последние сетевые запросы</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {logs.slice(0, 24).map((log, index) => (
              <div key={`${log.ts}-${index}`} style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
                <div style={{ color: log.ok ? T.green : T.red, fontSize: 12, fontWeight: 850 }}>
                  {log.method} {log.status || 0} · {log.durationMs} ms
                </div>
                <div style={{ color: T.textSec, fontSize: 12, wordBreak: 'break-all', marginTop: 3 }}>{log.url}</div>
                {log.errorMessage && <div style={{ color: T.red, fontSize: 12, marginTop: 3 }}>{log.errorName}: {log.errorMessage}</div>}
              </div>
            ))}
            {!logs.length && <div style={{ color: T.textSec, fontSize: 13 }}>Пока нет сетевых запросов.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

const APG_BG = 'radial-gradient(circle at 20% 10%, rgba(201,168,76,0.12), transparent 30%), linear-gradient(180deg, #11111f 0%, #080812 100%)';
