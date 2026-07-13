import React, { useState, useEffect, useCallback } from 'react';
import { Panel } from '@vkontakte/vkui';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { runServiceChecks, getDeviceInfo } from './diagnostics.js';
import { cleanupCurrentPushSubscriptions, collectPushDiagnostics, getPushRegistrationLog, registerCurrentPushDevice, sendCurrentDeviceTestPush } from './pushDiagnostics.js';
import { APG2_PROFILE, EmptyStateV2, GlassButton, GlassCard, GlassPanel, GlassSection, ScreenHeader } from './components/Apg2ProfileGlass.jsx';

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

export function ApgHealthPage({ nav = 'health', user = null, partners = [], experts = [], events = [], news = [], customTasks = [], userCount = 0, totalScans = 0, onBack, onGoAdmin }) {
  const [checks, setChecks]           = useState(null);
  const [checking, setChecking]       = useState(true);
  const [errorLogs, setErrorLogs]     = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [activeTab, setActiveTab]     = useState('overview');
  const [pushDiagnostics, setPushDiagnostics] = useState(null);
  const [pushBusy, setPushBusy] = useState('');
  const [pushResult, setPushResult] = useState(null);

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

  useEffect(() => {
    runChecks();
    refreshPushDiagnostics();
    getDocs(query(collection(db, 'errorLogs'), orderBy('createdAt', 'desc'), limit(20)))
      .then(snap => setErrorLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => {})
      .finally(() => setLoadingLogs(false));
  }, [refreshPushDiagnostics, runChecks]);

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

  const warnColor = { error: 'rgba(230,70,70,0.34)', warn: 'rgba(255,165,0,0.34)', info: 'rgba(215,184,106,0.28)' };
  const warnIcon  = { error: '🔴', warn: '🟡', info: 'ℹ️' };

  return (
    <Panel id={nav}>
      <GlassPanel>
        <ScreenHeader title="APG Health" subtitle="Диагностика системы" kicker="OWNER" onBack={onBack} />

        <GlassCard style={{ borderRadius: 28, padding: 6, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 0 }}>
          {[['overview', 'Обзор'], ['entities', 'Данные'], ['activity', 'Активность'], ['push', 'Push']].map(([id, label]) => (
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

      </GlassPanel>
    </Panel>
  );
}
