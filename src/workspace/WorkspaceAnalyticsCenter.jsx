import React, { useEffect, useMemo, useState } from 'react';
import { userAction } from '../userApi.js';
import {
  WORKSPACE_ANALYTICS_PERIODS,
  buildWorkspaceAnalyticsRange,
  workspaceAnalyticsRowsToCsv,
} from '../../server-shared/workspace-analytics.js';

const UI = {
  text: '#1F1A14',
  soft: 'rgba(31,26,20,0.64)',
  muted: 'rgba(31,26,20,0.46)',
  line: 'rgba(88,67,37,0.12)',
  card: 'rgba(255,255,255,0.78)',
  strong: 'rgba(255,255,255,0.94)',
  gold: '#C89B3C',
  green: '#2EB36B',
  red: '#D95D54',
  blue: '#5B8FDB',
  shadow: '0 22px 62px rgba(82,60,30,0.10)',
};

const KPI_LABELS = {
  profileViews: 'Просмотры профиля',
  newsViews: 'Просмотры новостей',
  eventViews: 'Просмотры мероприятий',
  clicks: 'Переходы',
  newRequests: 'Новые обращения',
  newDialogs: 'Новые диалоги',
  newBookings: 'Новые встречи',
  confirmedBookings: 'Подтверждены',
  completedBookings: 'Завершены',
  repeatedBookings: 'Повторные',
  newFollowers: 'Подписчики',
  comments: 'Комментарии',
  conversion: 'Конверсия',
};

function card(extra = {}) {
  return {
    background: UI.card,
    border: `1px solid ${UI.line}`,
    borderRadius: 8,
    boxShadow: UI.shadow,
    backdropFilter: 'blur(22px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(22px) saturate(1.4)',
    ...extra,
  };
}

function button(active = false, extra = {}) {
  return {
    minHeight: 38,
    border: active ? '1px solid rgba(200,155,60,0.52)' : `1px solid ${UI.line}`,
    background: active ? 'linear-gradient(135deg,#F3D98C,#C89B3C)' : 'rgba(255,255,255,0.64)',
    color: active ? '#241807' : UI.text,
    borderRadius: 8,
    padding: '8px 11px',
    fontSize: 13,
    fontWeight: 840,
    fontFamily: 'inherit',
    cursor: 'pointer',
    ...extra,
  };
}

function input(extra = {}) {
  return {
    minHeight: 38,
    borderRadius: 8,
    border: `1px solid ${UI.line}`,
    background: 'rgba(255,255,255,0.72)',
    color: UI.text,
    outline: 'none',
    padding: '0 10px',
    fontFamily: 'inherit',
    fontSize: 13,
    ...extra,
  };
}

function formatValue(value, suffix = '') {
  if (typeof value === 'string') return value;
  if (Number(value) === 0) return suffix === '%' ? '0%' : '0';
  return `${Number(value || 0).toLocaleString('ru-RU')}${suffix}`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function KpiCard({ label, value, tone }) {
  const color = tone === 'green' ? UI.green : tone === 'red' ? UI.red : tone === 'blue' ? UI.blue : UI.gold;
  return (
    <div style={card({ padding: 12, minHeight: 74, boxShadow: '0 12px 32px rgba(82,60,30,0.07)' })}>
      <div style={{ color: UI.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0 }}>{label}</div>
      <div style={{ color, fontSize: 24, lineHeight: '29px', fontWeight: 930, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Section({ title, subtitle, action, children }) {
  return (
    <div style={card({ padding: 14, boxShadow: '0 14px 40px rgba(82,60,30,0.07)' })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: UI.text, fontSize: 18, lineHeight: '23px', fontWeight: 930 }}>{title}</div>
          {subtitle && <div style={{ color: UI.soft, fontSize: 12.5, lineHeight: '18px', marginTop: 3 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ onRetry }) {
  return (
    <div style={card({ padding: 28, textAlign: 'center', background: UI.strong })}>
      <div style={{ color: UI.text, fontSize: 20, fontWeight: 930 }}>Пока нет данных за выбранный период</div>
      <div style={{ color: UI.soft, fontSize: 13.5, lineHeight: '20px', margin: '7px auto 0', maxWidth: 520 }}>
        Аналитика показывает только реальные события, сохранённые в системе: просмотры, встречи, диалоги, комментарии, уведомления и сканы.
      </div>
      <button type="button" onClick={onRetry} style={button(true, { margin: '16px auto 0' })}>Повторить загрузку</button>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {[1, 2, 3].map(row => <div key={row} style={card({ height: row === 1 ? 118 : 220, opacity: 0.72, background: 'linear-gradient(90deg, rgba(255,255,255,0.52), rgba(255,255,255,0.86), rgba(255,255,255,0.52))' })} />)}
    </div>
  );
}

function Funnel({ items }) {
  const max = Math.max(1, ...items.map(item => Number(item.value || 0)));
  return (
    <div style={{ display: 'grid', gap: 9 }}>
      {items.map((item, index) => (
        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,0.34fr) minmax(0,1fr) 70px', gap: 10, alignItems: 'center' }}>
          <div style={{ color: UI.text, fontSize: 13, fontWeight: 850 }}>{index + 1}. {item.label}</div>
          <div style={{ height: 12, borderRadius: 999, background: 'rgba(88,67,37,0.08)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(4, Number(item.value || 0) / max * 100)}%`, height: '100%', borderRadius: 999, background: index === 0 ? UI.gold : index < 3 ? UI.blue : UI.green }} />
          </div>
          <div style={{ color: UI.text, fontSize: 14, fontWeight: 900, textAlign: 'right' }}>{formatValue(item.value)}</div>
        </div>
      ))}
    </div>
  );
}

function MiniChart({ rows, valueKey = 'views' }) {
  const max = Math.max(1, ...rows.map(item => Number(item[valueKey] || item.score || 0)));
  if (!rows.length) return <div style={{ color: UI.soft, fontSize: 13 }}>Данных нет.</div>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map(item => {
        const value = Number(item[valueKey] || item.score || 0);
        return (
          <div key={`${item.type}:${item.id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 78px', gap: 10, alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: UI.text, fontSize: 13, fontWeight: 860, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
              <div style={{ height: 7, borderRadius: 999, background: 'rgba(88,67,37,0.08)', overflow: 'hidden', marginTop: 5 }}>
                <div style={{ width: `${Math.max(5, value / max * 100)}%`, height: '100%', background: UI.gold, borderRadius: 999 }} />
              </div>
            </div>
            <div style={{ color: UI.soft, fontSize: 12, fontWeight: 820, textAlign: 'right' }}>{formatValue(value)}</div>
          </div>
        );
      })}
    </div>
  );
}

function PairGrid({ rows }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
      {rows.map(row => (
        <div key={row.label} style={{ border: `1px solid ${UI.line}`, borderRadius: 8, padding: 10, background: 'rgba(255,255,255,0.50)' }}>
          <div style={{ color: UI.muted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{row.label}</div>
          <div style={{ color: row.color || UI.text, fontSize: 20, lineHeight: '25px', fontWeight: 930, marginTop: 3 }}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

export function WorkspaceAnalyticsCenter({ role, profile, onOpenPanel, onToast }) {
  const storageKey = `apg.workspace.analytics.period.${role?.id || 'partner'}.${profile?.id || 'none'}`;
  const saved = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  }, [storageKey]);
  const [period, setPeriod] = useState(saved.period || '30d');
  const [from, setFrom] = useState(saved.from || '');
  const [to, setTo] = useState(saved.to || '');
  const [snapshot, setSnapshot] = useState(null);
  const [csv, setCsv] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const roleId = ['owner', 'super_admin', 'admin', 'moderator', 'editor', 'analyst'].includes(role?.id) ? 'admin' : role?.id === 'expert' ? 'expert' : 'partner';
  const range = useMemo(() => buildWorkspaceAnalyticsRange({ period, from, to }), [period, from, to]);

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError('');
    try {
      const result = await userAction('workspaceAnalytics:snapshot', { role: roleId, profileId: profile.id, period, from, to });
      setSnapshot(result.snapshot || null);
      setCsv(result.csv || workspaceAnalyticsRowsToCsv(result.snapshot?.exportRows || []));
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить аналитику.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ period, from, to }));
    load();
  }, [profile?.id, roleId, period, from, to]);

  const kpis = snapshot?.kpis || {};
  const hasAnyData = snapshot && Object.values(kpis).some(value => Number(value || 0) > 0);
  const exportBase = `apg-analytics-${profile?.id || 'profile'}-${range.period}`;

  const exportCsv = () => {
    downloadFile(`${exportBase}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
    onToast?.('CSV экспортирован.', 'success');
  };
  const exportXls = () => {
    const rows = snapshot?.exportRows || [];
    const html = `<table>${rows.map(row => `<tr>${row.map(cell => `<td>${String(cell ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</td>`).join('')}</tr>`).join('')}</table>`;
    downloadFile(`${exportBase}.xls`, html, 'application/vnd.ms-excel;charset=utf-8');
    onToast?.('XLSX-совместимый файл экспортирован.', 'success');
  };
  const exportPdf = () => {
    window.print();
    onToast?.('Открылось сохранение PDF через печать браузера.', 'success');
  };
  const openLoki = () => {
    sessionStorage.setItem('apg.workspace.analytics.lokiContext', JSON.stringify(snapshot?.lokiContext || {}));
    onOpenPanel?.('loki');
  };

  return (
    <div data-workspace-analytics-center style={{ display: 'grid', gap: 14 }}>
      <div style={card({ padding: 16, background: UI.strong })}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: UI.gold, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4 }}>Workspace Analytics</div>
            <div style={{ color: UI.text, fontSize: 30, lineHeight: '35px', fontWeight: 950, marginTop: 4 }}>Аналитика</div>
            <div style={{ color: UI.soft, fontSize: 14, lineHeight: '21px', marginTop: 6, maxWidth: 760 }}>
              Центр оценки эффективности на реальных данных АПГ: публикации, мероприятия, встречи, диалоги, комментарии, уведомления и QR.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" onClick={exportCsv} disabled={!snapshot} style={button(false)}>CSV</button>
            <button type="button" onClick={exportXls} disabled={!snapshot} style={button(false)}>XLSX</button>
            <button type="button" onClick={exportPdf} disabled={!snapshot} style={button(false)}>PDF</button>
            <button type="button" onClick={openLoki} disabled={!snapshot} style={button(true)}>Проанализировать результаты</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 }}>
          {WORKSPACE_ANALYTICS_PERIODS.map(item => (
            <button key={item.id} type="button" onClick={() => setPeriod(item.id)} style={button(period === item.id)}>{item.label}</button>
          ))}
          {period === 'custom' && (
            <>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={input()} />
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={input()} />
            </>
          )}
        </div>
      </div>

      {loading && <Skeleton />}
      {!loading && error && (
        <div style={card({ padding: 18, border: '1px solid rgba(217,93,84,0.34)', background: 'rgba(255,255,255,0.92)' })}>
          <div style={{ color: UI.red, fontSize: 17, fontWeight: 920 }}>Не удалось загрузить аналитику</div>
          <div style={{ color: UI.soft, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>{error}</div>
          <button type="button" onClick={load} style={button(true, { marginTop: 12 })}>Повторить</button>
        </div>
      )}
      {!loading && !error && snapshot && !hasAnyData && <Empty onRetry={load} />}
      {!loading && !error && snapshot && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            {Object.entries(KPI_LABELS).map(([key, label]) => (
              <KpiCard key={key} label={label} value={key === 'conversion' ? formatValue(kpis[key], '%') : formatValue(kpis[key])} tone={key.includes('completed') || key.includes('conversion') ? 'green' : key.includes('Dialogs') || key.includes('Requests') ? 'blue' : 'gold'} />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(320px,0.9fr)', gap: 14, alignItems: 'start' }}>
            <Section title="Воронка взаимодействия" subtitle="Показываются только этапы, где есть реальные события.">
              {snapshot.funnel?.length ? <Funnel items={snapshot.funnel} /> : <div style={{ color: UI.soft, fontSize: 13 }}>Для воронки пока нет сохранённых событий.</div>}
            </Section>
            <Section title="Рекомендации" subtitle="Выводы строятся только из текущих показателей.">
              <div style={{ display: 'grid', gap: 9 }}>
                {(snapshot.recommendations || []).map(item => (
                  <div key={item.id} style={{ border: `1px solid ${UI.line}`, borderRadius: 8, padding: 10, background: 'rgba(255,255,255,0.52)' }}>
                    <div style={{ color: UI.text, fontSize: 14, fontWeight: 900 }}>{item.title}</div>
                    <div style={{ color: UI.soft, fontSize: 12.5, lineHeight: '18px', marginTop: 4 }}>{item.reason}</div>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14 }}>
            <Section title="Новости" subtitle="Лучшие публикации, просмотры, комментарии и CTR.">
              <PairGrid rows={[
                { label: 'Материалов', value: snapshot.news.total },
                { label: 'Просмотры', value: snapshot.news.views },
                { label: 'Комментарии', value: snapshot.news.comments },
                { label: 'CTR', value: `${snapshot.news.ctr}%`, color: UI.green },
              ]} />
              <div style={{ marginTop: 12 }}><MiniChart rows={snapshot.news.top || []} valueKey="views" /></div>
            </Section>
            <Section title="Мероприятия" subtitle="Просмотры, регистрации, посещения и лучшие события.">
              <PairGrid rows={[
                { label: 'Событий', value: snapshot.events.total },
                { label: 'Просмотры', value: snapshot.events.views },
                { label: 'Регистрации', value: snapshot.events.registrations },
                { label: 'Отказы', value: snapshot.events.cancellations, color: UI.red },
              ]} />
              <div style={{ marginTop: 12 }}><MiniChart rows={snapshot.events.top || []} valueKey="registrations" /></div>
            </Section>
            <Section title="Встречи" subtitle="Статусы CRM, переносы, отмены и повторные встречи.">
              <PairGrid rows={[
                { label: 'Новые', value: snapshot.bookings.new },
                { label: 'Завершены', value: snapshot.bookings.completed, color: UI.green },
                { label: 'Отменены', value: snapshot.bookings.cancelled, color: UI.red },
                { label: 'Неявки', value: snapshot.bookings.noShow, color: UI.red },
                { label: 'Переносы', value: snapshot.bookings.rescheduled },
                { label: 'Повторные', value: snapshot.bookings.repeated, color: UI.green },
              ]} />
            </Section>
            <Section title="Диалоги" subtitle="Новые, активные, непрочитанные и закрытые обращения.">
              <PairGrid rows={[
                { label: 'Новые', value: snapshot.dialogs.new },
                { label: 'Активные', value: snapshot.dialogs.active, color: UI.green },
                { label: 'Непрочитанные', value: snapshot.dialogs.unread, color: snapshot.dialogs.unread ? UI.red : UI.green },
                { label: 'Закрытые', value: snapshot.dialogs.closed },
              ]} />
            </Section>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,0.9fr) minmax(0,1.1fr)', gap: 14 }}>
            <Section title="Профиль" subtitle="Нажатия и переходы, которые уже сохранены в карточке.">
              <PairGrid rows={[
                { label: 'Сайт', value: snapshot.profileActions.website },
                { label: 'Telegram', value: snapshot.profileActions.telegram },
                { label: 'Телефон', value: snapshot.profileActions.phone },
                { label: 'Маршрут', value: snapshot.profileActions.route },
                { label: 'Соцсети', value: snapshot.profileActions.social },
              ]} />
            </Section>
            <Section title="Источники" subtitle="Отображаются только источники, которые удалось определить по сохранённым данным.">
              {snapshot.sources?.length ? <MiniChart rows={snapshot.sources.map(item => ({ ...item, title: item.label, score: item.value, type: 'source' }))} /> : <div style={{ color: UI.soft, fontSize: 13 }}>Источники пока не определены.</div>}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

export default WorkspaceAnalyticsCenter;
