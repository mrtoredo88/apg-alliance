import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../constants.js';
import { apgIdentity } from '../apg/index.js';
import { enrichLead, nextBestAction, SALES_STAGE_LABELS, SALES_STAGES, summarizePipeline } from './salesAgentCore.js';

const initialForm = {
  name: '', category: 'food', website: '', vk: '', telegram: '', contact: '', city: 'Зеленоград', district: '', source: '', sourceUrl: '',
  local: true, hasOfflinePoint: true, activeSocials: true, runsEvents: false,
  hasRepeatCustomers: true, canBringAudience: true, decisionMakerFound: false,
};

async function salesRequest(action, payload = {}) {
  const token = await apgIdentity.getSessionToken?.().catch(() => '');
  if (!token) throw new Error('Требуется административная авторизация.');
  const response = await fetch(`${API_BASE_URL}/api/sales-ai`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-apg-auth': token },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || 'Не удалось выполнить действие AI-отдела продаж.');
    error.code = data.code;
    error.duplicate = data.duplicate;
    throw error;
  }
  return data;
}

function normalizeForDuplicate(value) {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

function duplicateOf(leads, candidate) {
  const name = normalizeForDuplicate(candidate.name);
  const website = normalizeForDuplicate(candidate.website);
  const vk = normalizeForDuplicate(candidate.vk);
  const telegram = normalizeForDuplicate(candidate.telegram);
  return leads.find(lead => {
    if (website && website === normalizeForDuplicate(lead.website)) return true;
    if (vk && vk === normalizeForDuplicate(lead.vk)) return true;
    if (telegram && telegram === normalizeForDuplicate(lead.telegram)) return true;
    return name && name === normalizeForDuplicate(lead.name) && normalizeForDuplicate(candidate.city) === normalizeForDuplicate(lead.city);
  });
}

export function SalesAiDashboard() {
  const [leads, setLeads] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const stats = useMemo(() => summarizePipeline(leads), [leads]);
  const selected = leads.find(lead => lead.id === selectedId) || leads[0] || null;

  const loadLeads = async () => {
    setLoading(true);
    try {
      const data = await salesRequest('list');
      const rows = Array.isArray(data.leads) ? data.leads : [];
      setLeads(rows);
      setSelectedId(current => current || rows[0]?.id || null);
    } catch (error) {
      setNotice(`Ошибка загрузки: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLeads(); }, []);

  const addLead = async event => {
    event.preventDefault();
    if (!form.name.trim() || busy) return;
    const existing = duplicateOf(leads, form);
    if (existing) {
      setSelectedId(existing.id);
      setNotice(`Похожий лид уже есть: ${existing.name}. Открыл существующую карточку.`);
      return;
    }
    setBusy(true); setNotice('');
    try {
      const prepared = enrichLead({ ...form, name: form.name.trim(), source: form.source.trim() || 'manual', sourceUrl: form.sourceUrl.trim() });
      const data = await salesRequest('create', { lead: prepared });
      setLeads(current => [data.lead, ...current]);
      setSelectedId(data.lead.id);
      setForm(initialForm);
      setNotice('Лид сохранён на сервере АПГ и передан Аналитику.');
    } catch (error) {
      if (error.code === 'sales-ai/duplicate' && error.duplicate?.id) {
        setSelectedId(error.duplicate.id);
        setNotice(`Сервер остановил дубль: ${error.duplicate.name || 'существующий лид'}.`);
      } else {
        setNotice(`Не удалось сохранить лид: ${error.message}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const updateLead = async (id, patch) => {
    const before = leads.find(lead => lead.id === id);
    if (!before) return;
    const optimistic = { ...before, ...patch, updatedAt: new Date().toISOString() };
    setLeads(current => current.map(lead => lead.id === id ? optimistic : lead));
    try {
      const data = await salesRequest('update', { id, patch });
      setLeads(current => current.map(lead => lead.id === id ? data.lead : lead));
    } catch (error) {
      setLeads(current => current.map(lead => lead.id === id ? before : lead));
      setNotice(`Изменение не сохранено: ${error.message}`);
    }
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>АПГ · AI-отдел продаж</div>
          <h1 style={styles.h1}>Разведка → анализ → оффер → контакт → результат</h1>
          <p style={styles.muted}>Лиды хранятся на backend АПГ. ИИ готовит решения, а отправка остаётся под контролем человека.</p>
        </div>
        <button type="button" onClick={loadLeads} disabled={loading} style={styles.secondary}>{loading ? 'Загрузка…' : '↻ Обновить'}</button>
      </header>

      {notice && <div style={styles.noticeTop}>{notice}</div>}

      <section style={styles.stats}>
        <Stat label="Лидов" value={stats.total} />
        <Stat label="Приоритетных" value={stats.highPriority} />
        <Stat label="Контактов" value={stats.contacted} />
        <Stat label="Ответов" value={stats.replied} />
        <Stat label="Встреч" value={stats.meetings} />
        <Stat label="Партнёров" value={stats.won} />
      </section>

      <section style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.h2}>🔎 Агент-разведчик</h2>
          <form onSubmit={addLead} style={{ display: 'grid', gap: 10 }}>
            <input style={styles.input} placeholder="Название компании" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select style={styles.input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="food">Еда</option><option value="beauty">Красота</option><option value="sport">Спорт</option>
              <option value="education">Образование</option><option value="entertainment">Развлечения</option>
              <option value="health">Здоровье</option><option value="pets">Животные</option><option value="services">Услуги</option><option value="other">Другое</option>
            </select>
            <div style={styles.twoCols}>
              <input style={styles.input} placeholder="Город" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              <input style={styles.input} placeholder="Район / локация" value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} />
            </div>
            <input style={styles.input} placeholder="Сайт" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
            <input style={styles.input} placeholder="VK" value={form.vk} onChange={e => setForm({ ...form, vk: e.target.value })} />
            <input style={styles.input} placeholder="Telegram" value={form.telegram} onChange={e => setForm({ ...form, telegram: e.target.value })} />
            <input style={styles.input} placeholder="Контакт / ЛПР" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value, decisionMakerFound: Boolean(e.target.value.trim()) })} />
            <div style={styles.twoCols}>
              <input style={styles.input} placeholder="Источник: поиск, рекомендация…" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />
              <input style={styles.input} placeholder="Ссылка на источник" value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} />
            </div>
            <div style={styles.checks}>
              <Check label="Офлайн-точка" checked={form.hasOfflinePoint} onChange={value => setForm({ ...form, hasOfflinePoint: value })} />
              <Check label="Активные соцсети" checked={form.activeSocials} onChange={value => setForm({ ...form, activeSocials: value })} />
              <Check label="Проводят события" checked={form.runsEvents} onChange={value => setForm({ ...form, runsEvents: value })} />
              <Check label="Повторные клиенты" checked={form.hasRepeatCustomers} onChange={value => setForm({ ...form, hasRepeatCustomers: value })} />
              <Check label="Может привести аудиторию" checked={form.canBringAudience} onChange={value => setForm({ ...form, canBringAudience: value })} />
            </div>
            <button style={styles.primary} disabled={busy} type="submit">{busy ? 'Сохраняю…' : 'Добавить и проанализировать'}</button>
          </form>
        </div>

        <div style={styles.card}>
          <h2 style={styles.h2}>🧠 Очередь лидов</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {loading && <div style={styles.empty}>Загружаю серверную очередь…</div>}
            {!loading && leads.length === 0 && <div style={styles.empty}>Добавь первый бизнес. Здесь появится приоритет и следующий шаг.</div>}
            {leads.map(lead => (
              <button key={lead.id} onClick={() => setSelectedId(lead.id)} style={{ ...styles.leadButton, borderColor: selected?.id === lead.id ? '#d8b75d' : '#303243' }}>
                <span><strong>{lead.name}</strong><br /><small style={styles.muted}>{[lead.city, lead.district, SALES_STAGE_LABELS[lead.stage]].filter(Boolean).join(' · ')}</small></span>
                <span style={scoreStyle(lead.priority)}>{lead.score}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...styles.card, gridColumn: 'span 2' }}>
          <h2 style={styles.h2}>✍️ Агент-продажник</h2>
          {!selected ? <div style={styles.empty}>Выбери лид, чтобы увидеть анализ и персональный оффер.</div> : (
            <div style={styles.detailGrid}>
              <div>
                <div style={styles.scoreRow}><span style={scoreStyle(selected.priority)}>{selected.score}/100</span><strong>{selected.name}</strong></div>
                <p style={styles.muted}>{selected.reasons?.join(' · ') || 'Недостаточно сигналов для подробной оценки'}</p>
                {(selected.source || selected.sourceUrl) && <div style={styles.meta}>Источник: {selected.source || 'не указан'}{selected.sourceUrl ? ` · ${selected.sourceUrl}` : ''}</div>}
                <label style={styles.label}>Статус</label>
                <select style={styles.input} value={selected.stage} onChange={e => updateLead(selected.id, { stage: e.target.value })}>
                  {SALES_STAGES.map(stage => <option key={stage} value={stage}>{SALES_STAGE_LABELS[stage]}</option>)}
                </select>
                <div style={styles.nextAction}>📌 {nextBestAction(selected)}</div>
              </div>
              <div>
                <label style={styles.label}>Черновик предложения</label>
                <textarea style={styles.textarea} value={selected.offerDraft || ''} onChange={e => updateLead(selected.id, { offerDraft: e.target.value })} />
                <div style={styles.notice}>📬 Агент-коммуникатор пока не отправляет сообщения сам. После проверки текст можно скопировать и отправить вручную.</div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }) { return <div style={styles.stat}><strong style={{ fontSize: 26 }}>{value}</strong><span style={styles.muted}>{label}</span></div>; }
function Check({ label, checked, onChange }) { return <label style={styles.check}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /> {label}</label>; }
function scoreStyle(priority) { return { minWidth: 46, height: 34, padding: '0 9px', borderRadius: 12, display: 'inline-grid', placeItems: 'center', fontWeight: 900, background: priority === 'high' ? '#294b32' : priority === 'medium' ? '#4b4229' : '#3c3446', color: '#fff' }; }

const styles = {
  page: { minHeight: '100vh', background: '#0d0e16', color: '#f7f4ea', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' },
  header: { maxWidth: 1180, margin: '0 auto 18px', display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }, eyebrow: { color: '#d8b75d', fontWeight: 850, letterSpacing: '.08em', fontSize: 12 },
  h1: { margin: '6px 0 8px', fontSize: 'clamp(25px,4vw,42px)' }, h2: { margin: '0 0 14px', fontSize: 17 }, muted: { color: '#aeb1bf' },
  noticeTop: { maxWidth: 1180, margin: '0 auto 12px', padding: '10px 12px', borderRadius: 12, background: '#181b28', border: '1px solid #343748', color: '#d8b75d', fontSize: 12 },
  stats: { maxWidth: 1180, margin: '0 auto 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 },
  stat: { border: '1px solid #2d3040', background: '#151722', borderRadius: 16, padding: 14, display: 'grid', gap: 3 },
  grid: { maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14 },
  card: { border: '1px solid #2d3040', background: '#151722', borderRadius: 20, padding: 18 },
  input: { width: '100%', boxSizing: 'border-box', height: 42, borderRadius: 12, border: '1px solid #343748', background: '#0f111a', color: '#fff', padding: '0 11px' }, twoCols: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 },
  checks: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 7 }, check: { color: '#c8cad3', fontSize: 13 },
  primary: { height: 42, border: 0, borderRadius: 12, background: '#d8b75d', color: '#15120a', fontWeight: 900, cursor: 'pointer' }, secondary: { minHeight: 38, borderRadius: 11, border: '1px solid #343748', background: '#151722', color: '#d8b75d', padding: '0 12px', cursor: 'pointer' },
  leadButton: { width: '100%', border: '1px solid', background: '#10121b', color: '#fff', borderRadius: 14, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', cursor: 'pointer' },
  empty: { padding: 18, borderRadius: 14, background: '#10121b', color: '#858999' }, detailGrid: { display: 'grid', gridTemplateColumns: 'minmax(0,.8fr) minmax(0,1.2fr)', gap: 18 },
  scoreRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 20 }, label: { display: 'block', margin: '12px 0 6px', color: '#aeb1bf', fontSize: 12, fontWeight: 800 }, meta: { fontSize: 11, color: '#858999', wordBreak: 'break-word' },
  textarea: { width: '100%', minHeight: 220, resize: 'vertical', boxSizing: 'border-box', borderRadius: 14, border: '1px solid #343748', background: '#0f111a', color: '#fff', padding: 12, lineHeight: 1.45 },
  nextAction: { marginTop: 12, borderRadius: 12, padding: 11, background: '#10121b', color: '#d8b75d', fontWeight: 750 }, notice: { marginTop: 10, color: '#9ca0ae', fontSize: 12, lineHeight: 1.45 },
};
