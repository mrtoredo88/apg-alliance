import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Panel } from '@vkontakte/vkui';
import { db, auth } from './firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { API_BASE_URL } from './constants.js';
import { runServiceChecks, getDeviceInfo } from './diagnostics.js';
import { cleanupCurrentPushSubscriptions, collectPushDiagnostics, getPushRegistrationLog, registerCurrentPushDevice, sendCurrentDeviceTestPush } from './pushDiagnostics.js';
import { APG2_PROFILE, EmptyStateV2, GlassButton, GlassCard, GlassPanel, GlassSection, ScreenHeader } from './components/Apg2ProfileGlass.jsx';
import { clearEmailLoginDiagnostics, readEmailLoginDiagnostics } from './auth/emailLoginDiagnostics.js';
import {
  buildPerformanceExport,
  forcePerformanceSnapshot,
  getCurrentPerformanceReport,
  readPerformanceRuns,
  summarizeRuns,
} from './performance/index.js';

function StatusDot({ ok, pending }) {
  if (pending) return <span style={{ fontSize: 16 }}>⏳</span>;
  return <span style={{ fontSize: 16 }}>{ok ? '🟢' : '🔴'}</span>;
}

function StatusRow({ label, ok, pending, detail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <StatusDot ok={ok} pending={pending} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 14, fontWeight: 820 }}>{label}</div>
        {detail && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>}
      </div>
    </div>
  );
}

function CountCard({ icon, label, value }) {
  return (
    <GlassCard style={{ borderRadius: 22, padding: '14px 12px' }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ color: APG2_PROFILE.text, fontSize: 26, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value != null ? Number(value).toLocaleString('ru-RU') : '—'}
      </div>
      <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, marginTop: 4 }}>{label}</div>
    </GlassCard>
  );
}

function DiagnosticLine({ label, value, tone = 'default' }) {
  const color = tone === 'ok' ? '#4ade80' : tone === 'bad' ? '#f87171' : APG2_PROFILE.text;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 760 }}>{label}</span>
      <span style={{ color, fontSize: 12, fontWeight: 850, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '62%' }}>{value ?? '—'}</span>
    </div>
  );
}

function formatMs(value) {
  const num = Number(value || 0);
  return num > 0 ? `${Math.round(num)} ms` : '—';
}

function formatSummaryRow(row = {}) {
  if (!row || row.avg == null) return '—';
  return `avg ${Math.round(row.avg)} · min ${Math.round(row.min)} · max ${Math.round(row.max)} ms`;
}

function stageTone(severity) {
  if (severity === 'critical') return 'bad';
  if (severity === 'slow') return 'warn';
  return 'ok';
}

function stageLabel(item = {}) {
  return String(item.stage || '').replace(/_/g, ' ');
}

function formatMemory(device = {}) {
  if (device.memory?.usedJSHeapSize) {
    const used = Math.round(device.memory.usedJSHeapSize / 1024 / 1024);
    const total = Math.round((device.memory.totalJSHeapSize || 0) / 1024 / 1024);
    return `${used} / ${total} MB`;
  }
  return device.deviceMemory ? `${device.deviceMemory} GB device` : '—';
}

function formatKb(value) {
  const num = Number(value || 0);
  return num > 0 ? `${Math.round(num * 10) / 10} KB` : '—';
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function ApgHealthPage({ nav = 'health', user = null, partners = [], experts = [], events = [], news = [], customTasks = [], userCount = 0, totalScans = 0, onBack, onGoAdmin }) {
  const [checks, setChecks]           = useState(null);
  const [checking, setChecking]       = useState(true);
  const [errorLogs, setErrorLogs]     = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [activeTab, setActiveTab]     = useState('overview');
  const [pushDiagnostics, setPushDiagnostics] = useState(null);
  const [pushBusy, setPushBusy] = useState('');
  const [pushResult, setPushResult] = useState(null);
  const [performanceReport, setPerformanceReport] = useState(() => getCurrentPerformanceReport());
  const [performanceRuns, setPerformanceRuns] = useState(() => readPerformanceRuns());
  const [performanceCopied, setPerformanceCopied] = useState(false);
  const [emailLoginDiagnostics, setEmailLoginDiagnostics] = useState(() => readEmailLoginDiagnostics());
  const [architectureStatus, setArchitectureStatus] = useState(null);
  const [releaseStatus, setReleaseStatus] = useState(null);

  const runChecks = useCallback(async () => {
    setChecking(true);
    try {
      const result = await runServiceChecks();
      setChecks(result);
    } catch {
      setChecks(null);
    }
    setChecking(false);
  }, []);

  const refreshPushDiagnostics = useCallback(async () => {
    const result = await collectPushDiagnostics(user || {}).catch(error => ({ error: error?.message || 'push diagnostics failed', localLog: getPushRegistrationLog() }));
    setPushDiagnostics(result);
    return result;
  }, [user]);

  const refreshArchitectureStatus = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken?.(false);
      if (!token) {
        setArchitectureStatus({ ok: false, error: 'Admin token unavailable' });
        return null;
      }
      const response = await fetch(`${API_BASE_URL}/api/system-status`, {
        headers: { 'X-Firebase-Auth': token, 'X-APG-Version': 'health-architecture-v1' },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Architecture status unavailable');
      setArchitectureStatus(data);
      return data;
    } catch (error) {
      setArchitectureStatus({ ok: false, error: error?.message || 'Architecture status unavailable' });
      return null;
    }
  }, []);

  const refreshReleaseStatus = useCallback(async () => {
    const result = { checkedAt: new Date().toISOString(), frontend: null, backend: null, error: null };
    try {
      const [frontendResponse, backendResponse] = await Promise.all([
        fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${API_BASE_URL}/version?_=${Date.now()}`, { cache: 'no-store' }),
      ]);
      result.frontend = frontendResponse.ok ? await frontendResponse.json().catch(() => null) : { error: `HTTP ${frontendResponse.status}` };
      result.backend = backendResponse.ok ? await backendResponse.json().catch(() => null) : { error: `HTTP ${backendResponse.status}` };
    } catch (error) {
      result.error = error?.message || 'Runtime status unavailable';
    }
    setReleaseStatus(result);
    return result;
  }, []);

  useEffect(() => {
    runChecks();
    refreshPushDiagnostics();
    refreshArchitectureStatus();
    refreshReleaseStatus();
    getDocs(query(collection(db, 'errorLogs'), orderBy('createdAt', 'desc'), limit(20)))
      .then(snap => setErrorLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => {})
      .finally(() => setLoadingLogs(false));
  }, [refreshArchitectureStatus, refreshPushDiagnostics, refreshReleaseStatus, runChecks]);

  const refreshPerformance = useCallback(() => {
    const report = forcePerformanceSnapshot('health_refresh');
    setPerformanceReport(report);
    setPerformanceRuns(readPerformanceRuns());
    setEmailLoginDiagnostics(readEmailLoginDiagnostics());
    return report;
  }, []);

  useEffect(() => {
    refreshPerformance();
    const timer = window.setInterval(refreshPerformance, 2500);
    return () => window.clearInterval(timer);
  }, [refreshPerformance]);

  const runPushAction = async (action) => {
    setPushBusy(action);
    setPushResult(null);
    try {
      const result = action === 'register'
        ? await registerCurrentPushDevice(user || {})
        : action === 'cleanup'
          ? await cleanupCurrentPushSubscriptions(user || {})
          : await sendCurrentDeviceTestPush(user || {});
      setPushResult({ ok: result?.ok !== false, action, result });
      await refreshPushDiagnostics();
    } catch (e) {
      setPushResult({ ok: false, action, error: e?.message || 'Ошибка push диагностики' });
      await refreshPushDiagnostics();
    }
    setPushBusy('');
  };

  const devInfo = getDeviceInfo();
  const online  = navigator.onLine;

  const warnings = [
    !online                           && { type: 'error', msg: 'Нет подключения к интернету' },
    checks && !checks.backend?.ok     && { type: 'error', msg: `API недоступен${checks.backend?.error ? ': ' + checks.backend.error : ''}` },
    checks && !checks.firestore?.ok   && { type: 'error', msg: `Firestore недоступен${checks.firestore?.error ? ': ' + checks.firestore.error : ''}` },
    partners.length === 0             && { type: 'warn',  msg: 'Нет партнёров в каталоге' },
    experts.length  === 0             && { type: 'warn',  msg: 'Нет экспертов в каталоге' },
    news.length     === 0             && { type: 'warn',  msg: 'Нет новостей' },
    events.length   === 0             && { type: 'info',  msg: 'Нет предстоящих событий' },
  ].filter(Boolean);

  const recentPartners = [...partners]
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ?? 0);
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ?? 0);
      return tb - ta;
    })
    .slice(0, 5);

  const recentNews = [...news].slice(0, 5);
  const performanceSummary = useMemo(() => summarizeRuns(performanceRuns), [performanceRuns]);
  const performanceTimeline = Array.isArray(performanceReport?.timeline) ? performanceReport.timeline : [];
  const slowStages = performanceTimeline.filter(item => item.severity === 'slow' || item.severity === 'critical');
  const startupRows = performanceTimeline
    .filter(item => [
      'index_loaded',
      'main_module_loaded',
      'react_render_start',
      'react_render_complete',
      'router_ready',
      'userapp_mount',
      'firebase_ready',
      'auth_ready',
      'journey_ready',
      'loki_ready',
      'workspace_ready',
      'home_ready',
      'home_hydration_start',
      'home_shell_ready',
      'home_news_ready',
      'home_partners_ready',
      'home_events_ready',
      'home_journey_ready',
      'home_loki_ready',
      'home_recommendations_ready',
      'home_hydration_complete',
      'home_cache_restore',
      'home_cache_hit',
      'home_cache_miss',
      'home_cache_refresh',
      'home_cache_update',
      'firebase_start',
      'firebase_retry',
      'firebase_recovered',
      'firebase_offline',
      'firebase_online',
      'firebase_auth_ready',
      'bootstrap_critical_start',
      'bootstrap_critical_complete',
      'bootstrap_interactive_start',
      'bootstrap_interactive_complete',
      'bootstrap_idle_start',
      'bootstrap_idle_complete',
      'idle_complete',
    ].includes(item.stage))
    .slice(-18);
  const bootstrapRows = performanceTimeline
    .filter(item => String(item.stage || '').startsWith('bootstrap_') || item.stage === 'home_ready')
    .slice(-18);
  const homeHydrationRows = performanceTimeline
    .filter(item => {
      const stage = String(item.stage || '');
      return (stage.startsWith('home_') && stage.includes('_ready')) || stage === 'home_hydration_start' || stage === 'home_hydration_complete';
    })
    .slice(-18);
  const homeCacheRows = performanceTimeline
    .filter(item => String(item.stage || '').startsWith('home_cache_'))
    .slice(-18);
  const homeCache = performanceReport?.homeCache || {};
  const homeCacheSections = homeCache.sections || {};
  const firebaseStartup = performanceReport?.firebaseStartup || {};
  const firebaseStartupRows = performanceTimeline
    .filter(item => String(item.stage || '').startsWith('firebase_'))
    .slice(-18);
  const frontendVersion = releaseStatus?.frontend?.v || performanceReport?.version || '—';
  const backendVersion = releaseStatus?.backend?.appVersion || architectureStatus?.runtime?.backend?.appVersion || architectureStatus?.api?.version || '—';
  const backendGit = releaseStatus?.backend?.git || architectureStatus?.runtime?.backend?.git || '—';
  const releaseParity = frontendVersion !== '—' && backendVersion !== '—'
    ? String(backendVersion).startsWith(String(frontendVersion).slice(0, 8)) || String(frontendVersion).startsWith(String(backendVersion).slice(0, 8))
    : null;
  const telegramAuth = architectureStatus?.telegramAuth || {};
  const telegramSessions = architectureStatus?.telegramAuthSessions || {};
  const recentTelegramSessions = Array.isArray(telegramSessions.recent) ? telegramSessions.recent : [];

  const warnColor = { error: 'rgba(230,70,70,0.34)', warn: 'rgba(255,165,0,0.34)', info: 'rgba(215,184,106,0.28)' };
  const warnIcon  = { error: '🔴', warn: '🟡', info: 'ℹ️' };

  return (
    <Panel id={nav}>
      <GlassPanel>
        <ScreenHeader title="APG Health" subtitle="Диагностика системы" kicker="OWNER" onBack={onBack} />

        <GlassCard style={{ borderRadius: 28, padding: 6, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: 6, marginTop: 0 }}>
          {[['overview', 'Обзор'], ['runtime', 'Runtime'], ['entities', 'Данные'], ['activity', 'Активность'], ['push', 'Push'], ['email', 'Email'], ['architecture', 'Arch'], ['performance', 'Perf']].map(([id, label]) => (
            <GlassButton key={id} onClick={() => setActiveTab(id)} tone={activeTab === id ? 'gold' : 'glass'} style={{ minHeight: 44, borderRadius: 20, color: activeTab === id ? '#17120a' : APG2_PROFILE.text }}>{label}</GlassButton>
          ))}
        </GlassCard>

        {/* ── ОБЗОР ── */}
        {activeTab === 'overview' && (
          <>
            {warnings.length > 0 && (
              <GlassSection title="Предупреждения">
                <div style={{ display: 'grid', gap: 8 }}>
                  {warnings.map((w, i) => (
                    <GlassCard key={i} style={{ borderRadius: 20, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${warnColor[w.type]}` }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{warnIcon[w.type]}</span>
                      <span style={{ color: APG2_PROFILE.text, fontSize: 13, fontWeight: 760 }}>{w.msg}</span>
                    </GlassCard>
                  ))}
                </div>
              </GlassSection>
            )}

            <GlassSection title="Состояние сервисов">
              <GlassCard style={{ borderRadius: 28 }}>
                <StatusRow
                  label="Frontend"
                  ok={true} pending={false}
                  detail={`${devInfo.browser} · ${devInfo.os}`}
                />
                <StatusRow
                  label="Интернет"
                  ok={online} pending={false}
                  detail={online ? 'Подключено' : 'Нет подключения'}
                />
                <StatusRow
                  label="Firebase Auth"
                  ok={checks?.auth?.ok ?? false} pending={checking}
                  detail={checking ? 'Проверяем...' : checks?.auth?.ok ? `OK · ${checks.auth.ms}ms` : (checks?.auth?.error ?? 'Ошибка')}
                />
                <StatusRow
                  label="Firestore"
                  ok={checks?.firestore?.ok ?? false} pending={checking}
                  detail={checking ? 'Проверяем...' : checks?.firestore?.ok ? `OK · ${checks.firestore.ms}ms` : (checks?.firestore?.error ?? 'Ошибка')}
                />
                <StatusRow
                  label="Backend API"
                  ok={checks?.backend?.ok ?? false} pending={checking}
                  detail={checking ? 'Проверяем...' : checks?.backend?.ok ? `OK · ${checks.backend.ms}ms` : (checks?.backend?.error ?? 'Ошибка')}
                />
                <StatusRow
                  label="Telegram Auth"
                  ok={telegramAuth.ok ?? false}
                  pending={!architectureStatus}
                  detail={architectureStatus ? `${telegramAuth.deliveryMode || telegramAuth.mode || 'unknown'} · poll age ${telegramAuth.pollAgeSec ?? '—'}s` : 'Проверяем runtime...'}
                />
              </GlassCard>
              <GlassButton onClick={runChecks} disabled={checking} style={{ width: '100%', marginTop: 10 }}>
                {checking ? 'Проверяем...' : '↻ Перепроверить'}
              </GlassButton>
            </GlassSection>

            <GlassSection title="Последние ошибки">
              {loadingLogs ? (
                <EmptyStateV2 icon="🔍" title="Загружаем логи" text="Читаем errorLogs из Firestore." />
              ) : errorLogs.length === 0 ? (
                <EmptyStateV2 icon="✅" title="Ошибок нет" text="Коллекция errorLogs пуста — всё в порядке." />
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {errorLogs.slice(0, 10).map(log => (
                    <GlassCard key={log.id} style={{ borderRadius: 20, border: '1px solid rgba(230,70,70,0.22)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: '#E64646', fontSize: 12, fontWeight: 800, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.errorText || log.error || log.message || 'Ошибка'}
                        </span>
                        <span style={{ color: APG2_PROFILE.textMuted, fontSize: 10, flexShrink: 0 }}>
                          {log.createdAt?.toDate
                            ? log.createdAt.toDate().toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                      </div>
                      {(log.userId || log.uid) && (
                        <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11 }}>uid: {log.userId || log.uid}</div>
                      )}
                    </GlassCard>
                  ))}
                </div>
              )}
            </GlassSection>

            <GlassSection title="Быстрые действия">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <GlassButton onClick={onGoAdmin} style={{ borderRadius: 20, minHeight: 48 }}>⚙️ Adminка</GlassButton>
                <GlassButton onClick={() => setActiveTab('entities')} style={{ borderRadius: 20, minHeight: 48 }}>📊 Данные</GlassButton>
                <GlassButton onClick={() => setActiveTab('activity')} style={{ borderRadius: 20, minHeight: 48 }}>📋 Активность</GlassButton>
                <GlassButton onClick={runChecks} disabled={checking} style={{ borderRadius: 20, minHeight: 48 }}>↻ Сервисы</GlassButton>
              </div>
            </GlassSection>
          </>
        )}

        {activeTab === 'runtime' && (
          <>
            <GlassSection title="Production Runtime">
              <GlassCard style={{ borderRadius: 28, padding: 14 }}>
                <DiagnosticLine label="Frontend version" value={frontendVersion} tone={frontendVersion !== '—' ? 'ok' : 'bad'} />
                <DiagnosticLine label="Backend version" value={backendVersion} tone={backendVersion !== '—' ? 'ok' : 'bad'} />
                <DiagnosticLine label="Backend git" value={backendGit} />
                <DiagnosticLine label="Backend image" value={releaseStatus?.backend?.image || architectureStatus?.runtime?.backend?.image || '—'} />
                <DiagnosticLine label="Backend build" value={releaseStatus?.backend?.build || architectureStatus?.runtime?.backend?.build || '—'} />
                <DiagnosticLine label="Release parity" value={releaseParity == null ? '—' : releaseParity ? 'MATCH' : 'DIFFERENT'} tone={releaseParity == null ? 'default' : releaseParity ? 'ok' : 'bad'} />
                <DiagnosticLine label="Status checked" value={formatDateTime(releaseStatus?.checkedAt || architectureStatus?.checkedAt)} />
              </GlassCard>
            </GlassSection>

            <GlassSection title="Telegram Auth Runtime">
              <GlassCard style={{ borderRadius: 28, padding: 14 }}>
                <DiagnosticLine label="Delivery mode" value={telegramAuth.deliveryMode || telegramAuth.mode || '—'} tone={telegramAuth.ok ? 'ok' : 'bad'} />
                <DiagnosticLine label="Webhook URL" value={telegramAuth.webhookUrl || 'empty'} tone={!telegramAuth.webhookUrl ? 'ok' : 'bad'} />
                <DiagnosticLine label="Last poll" value={formatDateTime(telegramAuth.lastPollAt)} tone={telegramAuth.ok ? 'ok' : 'bad'} />
                <DiagnosticLine label="Poll age" value={telegramAuth.pollAgeSec == null ? '—' : `${telegramAuth.pollAgeSec}s`} tone={telegramAuth.ok ? 'ok' : 'bad'} />
                <DiagnosticLine label="Last update" value={formatDateTime(telegramAuth.lastUpdateAt)} />
                <DiagnosticLine label="Processed total" value={telegramAuth.processedTotal ?? '—'} />
                <DiagnosticLine label="Last error" value={telegramAuth.lastError || '—'} tone={telegramAuth.lastError ? 'bad' : 'ok'} />
                <DiagnosticLine label="Last error code" value={telegramAuth.lastErrorCode || '—'} tone={telegramAuth.lastErrorCode ? 'bad' : 'ok'} />
                <DiagnosticLine label="Pending sessions" value={telegramAuth.pendingSessions ?? telegramSessions.pending ?? '—'} tone={(telegramAuth.pendingSessions ?? 0) > 0 ? 'bad' : 'ok'} />
                <DiagnosticLine label="Recent expired" value={telegramAuth.expiredRecentSessions ?? telegramSessions.expired ?? '—'} tone={(telegramAuth.expiredRecentSessions ?? 0) > 0 ? 'bad' : 'ok'} />
                <DiagnosticLine label="Last auth done" value={formatDateTime(telegramAuth.lastAuthDoneAt || telegramSessions.lastDoneAt)} />
                <DiagnosticLine label="Last auth failure" value={telegramAuth.lastAuthFailureReason || telegramSessions.lastFailureReason || '—'} tone={(telegramAuth.lastAuthFailureReason || telegramSessions.lastFailureReason) ? 'bad' : 'ok'} />
              </GlassCard>
            </GlassSection>

            <GlassSection title="Recent Telegram Auth Sessions">
              {recentTelegramSessions.length === 0 ? (
                <EmptyStateV2 icon="🔐" title="Сессий нет" text="Backend пока не вернул последние Telegram auth sessions." />
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {recentTelegramSessions.map(session => {
                    const ok = session.status === 'done';
                    const bad = ['expired', 'failed', 'error'].includes(session.status) || session.failureReason;
                    return (
                      <GlassCard key={session.id} style={{ borderRadius: 20, padding: '11px 12px', border: `1px solid ${bad ? 'rgba(248,113,113,0.34)' : ok ? 'rgba(74,222,128,0.28)' : 'rgba(215,184,106,0.26)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                          <span style={{ color: ok ? '#4ade80' : bad ? '#f87171' : APG2_PROFILE.gold, fontSize: 12, fontWeight: 900 }}>{session.status}</span>
                          <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 800 }}>{formatDateTime(session.createdAt)}</span>
                        </div>
                        <div style={{ color: APG2_PROFILE.text, fontSize: 12, fontWeight: 820, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.telegramSessionId || session.id}</div>
                        <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '16px', marginTop: 4 }}>
                          {[session.source, session.lastTimelineStage, session.failureReason, session.tgUserId ? `tg ${session.tgUserId}` : ''].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                <GlassButton onClick={refreshArchitectureStatus} style={{ minHeight: 48, borderRadius: 20 }}>↻ Telegram</GlassButton>
                <GlassButton onClick={refreshReleaseStatus} style={{ minHeight: 48, borderRadius: 20 }}>↻ Runtime</GlassButton>
              </div>
            </GlassSection>
          </>
        )}

        {/* ── ДАННЫЕ ── */}
        {activeTab === 'entities' && (
          <GlassSection title="Сущности">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <CountCard icon="🏪" label="Партнёров"       value={partners.length} />
              <CountCard icon="🧑‍💼" label="Экспертов"      value={experts.length} />
              <CountCard icon="👥" label="Участников"      value={userCount} />
              <CountCard icon="📰" label="Новостей"        value={news.length} />
              <CountCard icon="📅" label="Событий"         value={events.length} />
              <CountCard icon="📋" label="Заданий"         value={customTasks.length} />
              <CountCard icon="🔑" label="Сканов всего"    value={totalScans} />
              <CountCard icon="⚠️" label="Ошибок в логе"   value={errorLogs.length} />
            </div>
          </GlassSection>
        )}

        {/* ── АКТИВНОСТЬ ── */}
        {activeTab === 'activity' && (
          <>
            <GlassSection title="Последние партнёры">
              {recentPartners.length === 0 ? (
                <EmptyStateV2 icon="🏪" title="Нет данных" text="Список партнёров пуст или не загружен." />
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {recentPartners.map(p => (
                    <GlassCard key={p.id} style={{ borderRadius: 22, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 12, background: APG2_PROFILE.goldSoft, display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0, overflow: 'hidden' }}>
                        {p.logoUrl
                          ? <img src={p.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
                          : (p.emoji || '🏪')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: APG2_PROFILE.text, fontSize: 14, fontWeight: 820, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, marginTop: 2 }}>{p.categoryLabel || p.category || p.address || ''}</div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </GlassSection>

            <GlassSection title="Последние новости">
              {recentNews.length === 0 ? (
                <EmptyStateV2 icon="📰" title="Нет новостей" text="Список новостей пуст или не загружен." />
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {recentNews.map((n, i) => (
                    <GlassCard key={n.id || i} style={{ borderRadius: 22, padding: '12px 14px' }}>
                      <div style={{ color: APG2_PROFILE.text, fontSize: 14, fontWeight: 820, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.title || n.text?.slice(0, 60) || 'Новость'}
                      </div>
                      <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11 }}>
                        {n.createdAt?.toDate
                          ? n.createdAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
                          : ''}
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </GlassSection>
          </>
        )}

        {activeTab === 'push' && (
          <>
            <GlassSection title="Push Diagnostics">
              <GlassCard style={{ borderRadius: 28, padding: 14 }}>
                <DiagnosticLine label="UID" value={user?.id || 'нет пользователя'} />
                <DiagnosticLine label="Способ входа" value={user?.email ? 'Email' : user?.telegramId || user?.tgId ? 'Telegram' : user?.vkId ? 'VK' : 'Firebase / linked profile'} />
                <DiagnosticLine label="Email / Telegram / VK" value={user?.email || user?.linkedEmail || user?.telegramUsername || user?.telegramId || user?.vkId || '—'} />
                <DiagnosticLine label="Device ID" value={pushDiagnostics?.deviceId} />
                <DiagnosticLine label="Platform" value={`${pushDiagnostics?.platform || '—'} · ${pushDiagnostics?.device || ''} · ${pushDiagnostics?.os || ''}`} />
                <DiagnosticLine label="Notification permission" value={pushDiagnostics?.notificationPermission} tone={pushDiagnostics?.notificationPermission === 'granted' ? 'ok' : 'bad'} />
                <DiagnosticLine label="Service Worker" value={pushDiagnostics?.serviceWorkerReady ? 'READY' : 'NOT READY'} tone={pushDiagnostics?.serviceWorkerReady ? 'ok' : 'bad'} />
                <DiagnosticLine label="PushManager" value={pushDiagnostics?.pushManagerSupported ? 'SUPPORTED' : 'UNSUPPORTED'} tone={pushDiagnostics?.pushManagerSupported ? 'ok' : 'bad'} />
                <DiagnosticLine label="Web Push subscription" value={pushDiagnostics?.subscriptionExists ? 'ACTIVE' : 'MISSING'} tone={pushDiagnostics?.subscriptionExists ? 'ok' : 'bad'} />
                <DiagnosticLine label="Active subscription in profile" value={pushDiagnostics?.subscriptionActiveInProfile ? 'YES' : 'NO'} tone={pushDiagnostics?.subscriptionActiveInProfile ? 'ok' : 'bad'} />
                <DiagnosticLine label="Endpoint host" value={pushDiagnostics?.subscriptionEndpointHost || '—'} />
                <DiagnosticLine label="FCM" value={`${pushDiagnostics?.fcmTokenCount ?? 0} tokens`} />
                <DiagnosticLine label="Last registration" value={pushDiagnostics?.lastRegistration || '—'} />
                <DiagnosticLine label="Last successful push" value={pushDiagnostics?.lastSuccessfulPush || '—'} />
                <DiagnosticLine label="Last push status" value={pushDiagnostics?.lastPushStatus || '—'} />
                <DiagnosticLine label="Registered devices" value={pushDiagnostics?.registeredDeviceCount ?? 0} />
                <DiagnosticLine label="Profile subscriptions" value={pushDiagnostics?.profileSubscriptionCount ?? 0} />
              </GlassCard>
            </GlassSection>

            <GlassSection title="Действия">
              <div style={{ display: 'grid', gap: 8 }}>
                <GlassButton onClick={() => runPushAction('register')} disabled={!!pushBusy} tone="gold" style={{ minHeight: 48, color: '#17120a' }}>{pushBusy === 'register' ? 'Регистрируем...' : '🔄 Перерегистрировать устройство'}</GlassButton>
                <GlassButton onClick={() => runPushAction('cleanup')} disabled={!!pushBusy} style={{ minHeight: 48 }}>{pushBusy === 'cleanup' ? 'Очищаем...' : '🧹 Очистить старые подписки'}</GlassButton>
                <GlassButton onClick={() => runPushAction('test')} disabled={!!pushBusy} style={{ minHeight: 48 }}>{pushBusy === 'test' ? 'Отправляем...' : '🧪 Отправить тестовый push на это устройство'}</GlassButton>
                <GlassButton onClick={refreshPushDiagnostics} disabled={!!pushBusy} style={{ minHeight: 48 }}>↻ Обновить диагностику</GlassButton>
              </div>
              {pushResult && (
                <GlassCard style={{ borderRadius: 22, padding: 12, marginTop: 10, border: `1px solid ${pushResult.ok ? 'rgba(74,222,128,0.34)' : 'rgba(248,113,113,0.34)'}` }}>
                  <div style={{ color: pushResult.ok ? '#4ade80' : '#f87171', fontSize: 13, fontWeight: 850 }}>{pushResult.ok ? 'Готово' : 'Ошибка'}</div>
                  <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '18px', marginTop: 4 }}>{pushResult.error || JSON.stringify(pushResult.result)}</div>
                </GlassCard>
              )}
            </GlassSection>

            <GlassSection title="Лог регистрации">
              <div style={{ display: 'grid', gap: 8 }}>
                {(pushDiagnostics?.localLog || []).length === 0 ? (
                  <EmptyStateV2 icon="🔎" title="Лог пуст" text="После перерегистрации здесь появятся этапы push register." />
                ) : pushDiagnostics.localLog.map((item, index) => (
                  <GlassCard key={`${item.at}_${index}`} style={{ borderRadius: 18, padding: '10px 12px' }}>
                    <div style={{ color: APG2_PROFILE.text, fontSize: 12, fontWeight: 850 }}>{item.stage}</div>
                    <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, marginTop: 3 }}>{item.at}</div>
                  </GlassCard>
                ))}
              </div>
            </GlassSection>
          </>
        )}

        {activeTab === 'email' && (
          <>
            <GlassSection title="Email Login">
              <GlassCard style={{ borderRadius: 28, padding: 14 }}>
                <DiagnosticLine label="Последних этапов" value={emailLoginDiagnostics.length} />
                <DiagnosticLine label="Последний этап" value={emailLoginDiagnostics[emailLoginDiagnostics.length - 1]?.stage || '—'} tone={String(emailLoginDiagnostics[emailLoginDiagnostics.length - 1]?.stage || '').includes('failed') ? 'bad' : 'default'} />
                <DiagnosticLine label="Последний код" value={emailLoginDiagnostics.slice().reverse().find(item => item.code || item.error)?.code || emailLoginDiagnostics.slice().reverse().find(item => item.code || item.error)?.error || '—'} />
                <DiagnosticLine label="Failed stage" value={emailLoginDiagnostics.slice().reverse().find(item => item.failedStage)?.failedStage || '—'} />
                <DiagnosticLine label="Backend request" value={emailLoginDiagnostics.slice().reverse().find(item => item.requestIdBackend)?.requestIdBackend || '—'} />
              </GlassCard>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {emailLoginDiagnostics.length === 0 ? (
                  <EmptyStateV2 icon="✉️" title="Email Login пуст" text="После попытки входа здесь появится forensic timeline." />
                ) : emailLoginDiagnostics.slice().reverse().map((item, index) => (
                  <GlassCard key={`${item.at}_${item.stage}_${index}`} style={{ borderRadius: 18, padding: '10px 12px', border: item.stage === 'failed' || item.stage === 'network_error' ? '1px solid rgba(248,113,113,0.34)' : '1px solid rgba(255,255,255,0.10)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ color: APG2_PROFILE.text, fontSize: 12, fontWeight: 850 }}>{String(item.stage || '').replace(/_/g, ' ')}</span>
                      <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 850 }}>{item.durationMs != null ? `${item.durationMs} ms` : item.at}</span>
                    </div>
                    <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '16px', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {[item.code || item.error, item.failedStage, item.status ? `HTTP ${item.status}` : '', item.requestIdBackend || item.requestId].filter(Boolean).join(' · ') || 'OK'}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </GlassSection>
            <GlassSection title="Действия">
              <div style={{ display: 'grid', gap: 8 }}>
                <GlassButton onClick={() => setEmailLoginDiagnostics(readEmailLoginDiagnostics())} style={{ minHeight: 48 }}>↻ Обновить Email Login</GlassButton>
                <GlassButton onClick={() => { clearEmailLoginDiagnostics(); setEmailLoginDiagnostics([]); }} style={{ minHeight: 48 }}>Очистить Email Login</GlassButton>
              </div>
            </GlassSection>
          </>
        )}

        {activeTab === 'architecture' && (
          <>
            <GlassSection title="Architecture">
              <GlassCard style={{ borderRadius: 28, padding: 14 }}>
                <DiagnosticLine label="Identity Provider" value={architectureStatus?.architecture?.identityProvider || architectureStatus?.identity?.provider || '—'} />
                <DiagnosticLine label="Data Provider" value={architectureStatus?.architecture?.dataProvider || architectureStatus?.identity?.storage || '—'} />
                <DiagnosticLine label="Repository Coverage" value={architectureStatus?.architecture?.repositoryCoverage || '—'} />
                <DiagnosticLine label="Firestore Dependency" value={architectureStatus?.architecture?.firestoreDependency || '—'} />
                <DiagnosticLine label="Architecture Guard" value={architectureStatus?.architecture?.guard?.ok ? 'OK' : architectureStatus?.error || 'WARN'} tone={architectureStatus?.architecture?.guard?.ok ? 'ok' : 'bad'} />
                <DiagnosticLine label="Migration Status" value={architectureStatus?.architecture?.migrationStatus || '—'} />
              </GlassCard>
            </GlassSection>
            <GlassSection title="Identity Migration">
              <GlassCard style={{ borderRadius: 28, padding: 14 }}>
                <DiagnosticLine label="Identity reads Firestore" value={architectureStatus?.migration?.dependencyMonitor?.reads?.firestore ?? '—'} />
                <DiagnosticLine label="Identity reads PostgreSQL" value={architectureStatus?.migration?.dependencyMonitor?.reads?.postgres ?? '—'} />
                <DiagnosticLine label="Identity writes Firestore" value={architectureStatus?.migration?.dependencyMonitor?.writes?.firestore ?? '—'} />
                <DiagnosticLine label="Identity writes PostgreSQL" value={architectureStatus?.migration?.dependencyMonitor?.writes?.postgres ?? '—'} />
                <DiagnosticLine label="Fallback Count" value={architectureStatus?.migration?.dependencyMonitor?.fallback ?? '—'} />
                <DiagnosticLine label="Dual Read / Write" value={`${architectureStatus?.migration?.dependencyMonitor?.dualRead ? 'on' : 'off'} / ${architectureStatus?.migration?.dependencyMonitor?.dualWrite ? 'on' : 'off'}`} />
              </GlassCard>
              <GlassButton onClick={refreshArchitectureStatus} style={{ width: '100%', marginTop: 10, minHeight: 48 }}>↻ Обновить Architecture</GlassButton>
            </GlassSection>
          </>
        )}

        {activeTab === 'performance' && (
          <>
            <GlassSection title="Startup Timeline">
              <GlassCard style={{ borderRadius: 28, padding: 14 }}>
                <DiagnosticLine label="Startup" value={formatMs(performanceReport?.metrics?.startupMs)} />
                <DiagnosticLine label="React" value={formatMs(performanceReport?.metrics?.reactMs)} />
                <DiagnosticLine label="Firebase" value={formatMs(performanceReport?.metrics?.firebaseMs)} />
                <DiagnosticLine label="Auth" value={formatMs(performanceReport?.metrics?.authMs)} />
                <DiagnosticLine label="Home" value={formatMs(performanceReport?.metrics?.homeMs)} />
                <DiagnosticLine label="Loki" value={formatMs(performanceReport?.metrics?.lokiMs)} />
                <DiagnosticLine label="SW register" value={formatMs(performanceReport?.metrics?.serviceWorkerMs)} />
                <DiagnosticLine label="Critical queue" value={formatMs(performanceReport?.metrics?.bootstrapCriticalMs)} />
                <DiagnosticLine label="Interactive queue" value={formatMs(performanceReport?.metrics?.bootstrapInteractiveMs)} />
                <DiagnosticLine label="Idle queue" value={formatMs(performanceReport?.metrics?.bootstrapIdleMs)} />
                <DiagnosticLine label="FPS startup" value={performanceReport?.fps ? `${performanceReport.fps}` : '—'} />
              </GlassCard>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {startupRows.length === 0 ? (
                  <EmptyStateV2 icon="⏱" title="Таймлайн пуст" text="Метки появятся после запуска приложения." />
                ) : startupRows.map((item, index) => (
                  <GlassCard key={`${item.stage}_${index}_${item.relativeMs}`} style={{ borderRadius: 18, padding: '10px 12px', border: item.severity === 'critical' ? '1px solid rgba(248,113,113,0.34)' : item.severity === 'slow' ? '1px solid rgba(251,191,36,0.34)' : '1px solid rgba(255,255,255,0.10)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ color: APG2_PROFILE.text, fontSize: 12, fontWeight: 850, textTransform: 'capitalize' }}>{stageLabel(item)}</span>
                      <span style={{ color: item.severity === 'critical' ? '#f87171' : item.severity === 'slow' ? '#fbbf24' : APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>
                        +{Math.round(item.relativeMs || 0)} ms · {formatMs(item.durationMs)}
                      </span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </GlassSection>

            <GlassSection title="Firebase Startup">
              <GlassCard style={{ borderRadius: 28, padding: 14 }}>
                <DiagnosticLine label="Status" value={firebaseStartup.status || '—'} tone={firebaseStartup.status === 'recovered' || firebaseStartup.status === 'auth_ready' ? 'ok' : firebaseStartup.status === 'degraded' ? 'bad' : 'default'} />
                <DiagnosticLine label="Attempts" value={`${firebaseStartup.attempts || 0} / ${firebaseStartup.maxAttempts || 5}`} />
                <DiagnosticLine label="Startup" value={formatMs(firebaseStartup.startupMs)} />
                <DiagnosticLine label="Recovery" value={formatMs(firebaseStartup.recoveryMs || performanceReport?.metrics?.firebaseRecoveryMs)} />
                <DiagnosticLine label="Offline" value={firebaseStartup.offline ? 'yes' : 'no'} tone={firebaseStartup.offline ? 'bad' : 'ok'} />
                <DiagnosticLine label="Last stage" value={firebaseStartup.lastStage || '—'} />
                <DiagnosticLine label="Last error" value={firebaseStartup.lastError ? `${firebaseStartup.lastError.code || 'error'} · ${firebaseStartup.lastError.message}` : '—'} tone={firebaseStartup.lastError ? 'bad' : 'default'} />
              </GlassCard>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {firebaseStartupRows.length === 0 ? (
                  <EmptyStateV2 icon="⏱" title="Firebase Startup пуст" text="Метки auth/retry/recovery появятся после следующего запуска." />
                ) : firebaseStartupRows.map((item, index) => (
                  <GlassCard key={`${item.stage}_${index}_${item.relativeMs}`} style={{ borderRadius: 18, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ color: APG2_PROFILE.text, fontSize: 12, fontWeight: 850, textTransform: 'capitalize' }}>{stageLabel(item)}</span>
                      <span style={{ color: item.severity === 'critical' ? '#f87171' : item.severity === 'slow' ? '#fbbf24' : APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>
                        +{Math.round(item.relativeMs || 0)} ms · {formatMs(item.durationMs)}
                      </span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </GlassSection>

            <GlassSection title="Bootstrap Timeline">
              <GlassCard style={{ borderRadius: 28, padding: 14 }}>
                <DiagnosticLine label="Scheduler" value={performanceReport?.bootstrap?.status || '—'} />
                <DiagnosticLine label="CRITICAL" value={formatMs(performanceReport?.bootstrap?.queues?.critical?.durationMs)} />
                <DiagnosticLine label="INTERACTIVE" value={formatMs(performanceReport?.bootstrap?.queues?.interactive?.durationMs)} />
                <DiagnosticLine label="IDLE" value={formatMs(performanceReport?.bootstrap?.queues?.idle?.durationMs)} />
              </GlassCard>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {bootstrapRows.length === 0 ? (
                  <EmptyStateV2 icon="⏱" title="Bootstrap timeline пуст" text="Очереди появятся после следующего запуска." />
                ) : bootstrapRows.map((item, index) => (
                  <GlassCard key={`${item.stage}_${index}_${item.relativeMs}`} style={{ borderRadius: 18, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ color: APG2_PROFILE.text, fontSize: 12, fontWeight: 850, textTransform: 'capitalize' }}>{stageLabel(item)}</span>
                      <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>
                        +{Math.round(item.relativeMs || 0)} ms · {formatMs(item.durationMs)}
                      </span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </GlassSection>

            <GlassSection title="Home Hydration Timeline">
              <GlassCard style={{ borderRadius: 28, padding: 14 }}>
                <DiagnosticLine label="Home Shell" value={formatMs(performanceReport?.metrics?.homeShellMs)} />
                <DiagnosticLine label="News" value={formatMs(performanceReport?.metrics?.homeNewsMs)} />
                <DiagnosticLine label="Partners" value={formatMs(performanceReport?.metrics?.homePartnersMs)} />
                <DiagnosticLine label="Events" value={formatMs(performanceReport?.metrics?.homeEventsMs)} />
                <DiagnosticLine label="Journey" value={formatMs(performanceReport?.metrics?.homeJourneyMs)} />
                <DiagnosticLine label="Loki" value={formatMs(performanceReport?.metrics?.homeLokiHydrationMs)} />
                <DiagnosticLine label="Recommendations" value={formatMs(performanceReport?.metrics?.homeRecommendationsMs)} />
              </GlassCard>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {homeHydrationRows.length === 0 ? (
                  <EmptyStateV2 icon="⏱" title="Home hydration timeline пуст" text="Этапы главной появятся после следующего открытия Home." />
                ) : homeHydrationRows.map((item, index) => (
                  <GlassCard key={`${item.stage}_${index}_${item.relativeMs}`} style={{ borderRadius: 18, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ color: APG2_PROFILE.text, fontSize: 12, fontWeight: 850, textTransform: 'capitalize' }}>{stageLabel(item)}</span>
                      <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>
                        +{Math.round(item.relativeMs || 0)} ms · {formatMs(item.durationMs)}
                      </span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </GlassSection>

            <GlassSection title="Home Cache">
              <GlassCard style={{ borderRadius: 28, padding: 14 }}>
                <DiagnosticLine label="Status" value={homeCache.status || '—'} />
                <DiagnosticLine label="Hit / Miss" value={`${homeCache.hits || 0} / ${homeCache.misses || 0}`} />
                <DiagnosticLine label="Restore" value={formatMs(homeCache.lastRestoreMs)} />
                <DiagnosticLine label="Refresh" value={formatMs(homeCache.lastRefreshMs || performanceReport?.metrics?.homeCacheRefreshMs)} />
                <DiagnosticLine label="Update" value={formatMs(homeCache.lastUpdateMs || performanceReport?.metrics?.homeCacheUpdateMs)} />
                <DiagnosticLine label="TTL" value={homeCache.expired ? `expired: ${homeCache.expired}` : 'valid'} />
              </GlassCard>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 10 }}>
                {['news', 'partners', 'events', 'recommendations', 'journey'].map(section => {
                  const row = homeCacheSections[section] || {};
                  return (
                    <GlassCard key={section} style={{ borderRadius: 18, padding: '10px 12px' }}>
                      <div style={{ color: APG2_PROFILE.text, fontSize: 12, fontWeight: 850, textTransform: 'capitalize' }}>{section}</div>
                      <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, marginTop: 4 }}>{row.status || '—'} · {row.ttlStatus || '—'}</div>
                      <div style={{ color: APG2_PROFILE.text, fontSize: 18, fontWeight: 900, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{row.count || 0}</div>
                    </GlassCard>
                  );
                })}
              </div>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {homeCacheRows.length === 0 ? (
                  <EmptyStateV2 icon="⏱" title="Home Cache пуст" text="Hit/miss появятся после следующего запуска Home." />
                ) : homeCacheRows.map((item, index) => (
                  <GlassCard key={`${item.stage}_${index}_${item.relativeMs}`} style={{ borderRadius: 18, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ color: APG2_PROFILE.text, fontSize: 12, fontWeight: 850, textTransform: 'capitalize' }}>{stageLabel(item)}</span>
                      <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>
                        +{Math.round(item.relativeMs || 0)} ms · {formatMs(item.durationMs)}
                      </span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </GlassSection>

            <GlassSection title="Последние 20 запусков">
              <GlassCard style={{ borderRadius: 28, padding: 14 }}>
                <DiagnosticLine label="Запусков" value={performanceRuns.length} />
                <DiagnosticLine label="Startup" value={formatSummaryRow(performanceSummary.startup)} />
                <DiagnosticLine label="React" value={formatSummaryRow(performanceSummary.react)} />
                <DiagnosticLine label="Firebase" value={formatSummaryRow(performanceSummary.firebase)} />
                <DiagnosticLine label="Home" value={formatSummaryRow(performanceSummary.home)} />
                <DiagnosticLine label="Loki" value={formatSummaryRow(performanceSummary.loki)} />
                <DiagnosticLine label="SW" value={formatSummaryRow(performanceSummary.serviceWorker)} />
              </GlassCard>
            </GlassSection>

            <GlassSection title="Bundle / Device">
              <GlassCard style={{ borderRadius: 28, padding: 14 }}>
                <DiagnosticLine label="Build version" value={performanceReport?.version || 'unknown'} />
                <DiagnosticLine label="Build time" value={performanceReport?.buildTime || 'unknown'} />
                <DiagnosticLine label="Bundle version" value={performanceReport?.bundleVersion || '—'} />
                <DiagnosticLine label="Service Worker" value={performanceReport?.serviceWorkerVersion || '—'} />
                <DiagnosticLine label="Bundle chunks" value={performanceReport?.bundle?.totals?.chunks || 0} />
                <DiagnosticLine label="Bundle transfer" value={formatKb(performanceReport?.bundle?.totals?.transferKb)} />
                <DiagnosticLine label="Bundle encoded" value={formatKb(performanceReport?.bundle?.totals?.encodedKb)} />
                <DiagnosticLine label="Bundle decoded" value={formatKb(performanceReport?.bundle?.totals?.decodedKb)} />
                <DiagnosticLine label="Browser" value={performanceReport?.device?.browser || '—'} />
                <DiagnosticLine label="Platform" value={performanceReport?.device?.platform || '—'} />
                <DiagnosticLine label="Mode" value={`${performanceReport?.device?.displayMode || 'browser'} · standalone=${performanceReport?.device?.standalone ? 'yes' : 'no'}`} />
                <DiagnosticLine label="Viewport" value={performanceReport?.device?.viewport || '—'} />
                <DiagnosticLine label="Network" value={performanceReport?.device?.network || '—'} />
                <DiagnosticLine label="Memory" value={formatMemory(performanceReport?.device || {})} />
                <DiagnosticLine label="Render counts" value={Object.entries(performanceReport?.renderCounts || {}).map(([key, value]) => `${key}:${value}`).join(', ') || '—'} />
              </GlassCard>
            </GlassSection>

            <GlassSection title="Bundle Analysis">
              <div style={{ display: 'grid', gap: 10 }}>
                {Object.entries(performanceReport?.bundle?.categories || {}).length === 0 ? (
                  <EmptyStateV2 icon="📦" title="Bundle Analysis пуст" text="Данные появятся после загрузки production assets в текущей сессии." />
                ) : Object.entries(performanceReport.bundle.categories).map(([category, row]) => (
                  <GlassCard key={category} style={{ borderRadius: 18, padding: '10px 12px' }}>
                    <DiagnosticLine label={category} value={`${row.chunks} chunks · ${formatKb(row.encodedKb)} encoded · ${formatKb(row.decodedKb)} decoded`} />
                  </GlassCard>
                ))}
                {(performanceReport?.bundle?.chunks || []).slice(0, 8).map(chunk => (
                  <GlassCard key={chunk.name} style={{ borderRadius: 18, padding: '10px 12px' }}>
                    <DiagnosticLine label={chunk.name} value={`${chunk.category} · ${formatKb(chunk.encodedKb)} / ${formatKb(chunk.decodedKb)}`} />
                  </GlassCard>
                ))}
              </div>
            </GlassSection>

            <GlassSection title="Diagnostics">
              {slowStages.length === 0 ? (
                <EmptyStateV2 icon="✅" title="Медленных этапов нет" text="Этапы старта укладываются в текущие пороги." />
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {slowStages.slice(-10).map((item, index) => (
                    <GlassCard key={`${item.stage}_${index}`} style={{ borderRadius: 18, padding: '10px 12px' }}>
                      <DiagnosticLine label={stageLabel(item)} value={`${item.severity === 'critical' ? 'Critical' : 'Slow'} · ${formatMs(item.durationMs)}`} tone={stageTone(item.severity)} />
                    </GlassCard>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                <GlassButton onClick={refreshPerformance} style={{ minHeight: 48, borderRadius: 20 }}>↻ Обновить</GlassButton>
                <GlassButton
                  tone="gold"
                  onClick={async () => {
                    const report = refreshPerformance();
                    await navigator.clipboard?.writeText(buildPerformanceExport(report));
                    setPerformanceCopied(true);
                    window.setTimeout(() => setPerformanceCopied(false), 1400);
                  }}
                  style={{ minHeight: 48, borderRadius: 20, color: '#17120a' }}
                >
                  {performanceCopied ? 'Скопировано' : 'Скопировать отчёт'}
                </GlassButton>
              </div>
            </GlassSection>
          </>
        )}

      </GlassPanel>
    </Panel>
  );
}
