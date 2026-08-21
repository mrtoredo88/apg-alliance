import React, { useMemo, useState } from 'react';
import { enrichLead, nextBestAction, SALES_STAGE_LABELS, SALES_STAGES, summarizePipeline } from './salesAgentCore.js';

const STORAGE_KEY = 'apg_ai_sales_leads_v1';

function loadLeads() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLeads(leads) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(leads)); } catch {}
}

const initialForm = {
  name: '', category: 'food', website: '', vk: '', telegram: '', contact: '',
  local: true, hasOfflinePoint: true, activeSocials: true, runsEvents: false,
  hasRepeatCustomers: true, canBringAudience: true, decisionMakerFound: false,
};

export function SalesAiDashboard() {
  const [leads, setLeads] = useState(loadLeads);
  const [form, setForm] = useState(initialForm);
  const [selectedId, setSelectedId] = useState(null);
  const stats = useMemo(() => summarizePipeline(leads), [leads]);
  const selected = leads.find(lead => lead.id === selectedId) || leads[0] || null;

  const commit = updater => {
    setLeads(current => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      saveLeads(next);
      return next;
    });
  };

  const addLead = event => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const lead = enrichLead({ ...form, name: form.name.trim() });
    commit(current => [lead, ...current]);
    setSelectedId(lead.id);
    setForm(initialForm);
  };

  const updateLead = (id, patch) => {
    commit(current => current.map(lead => lead.id === id ? { ...lead, ...patch, updatedAt: new Date().toISOString() } : lead));
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>АПГ · AI-отдел продаж</div>
          <h1 style={styles.h1}>Разведка → анализ → оффер → контакт → результат</h1>
          <p style={styles.muted}>MVP работает как безопасный конвейер: ИИ готовит решения, а отправка остаётся под контролем человека.</p>
        </div>
      </header>

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
              <option value="health">Здоровье</option><option value="pets">Животные</option><option value="other">Другое</option>
            </select>
            <input style={styles.input} placeholder="Сайт" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
            <input style={styles.input} placeholder="VK" value={form.vk} onChange={e => setForm({ ...form, vk: e.target.value })} />
            <input style={styles.input} placeholder="Telegram" value={form.telegram} onChange={e => setForm({ ...form, telegram: e.target.value })} />
            <input style={styles.input} placeholder="Контакт / ЛПР" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value, decisionMakerFound: Boolean(e.target.value.trim()) })} />
            <div style={styles.checks}>
              <Check label="Офлайн-точка" checked={form.hasOfflinePoint} onChange={value => setForm({ ...form, hasOfflinePoint: value })} />
              <Check label="Активные соцсети" checked={form.activeSocials} onChange={value => setForm({ ...form, activeSocials: value })} />
              <Check label="Проводят события" checked={form.runsEvents} onChange={value => setForm({ ...form, runsEvents: value })} />
              <Check label="Повторные клиенты" checked={form.hasRepeatCustomers} onChange={value => setForm({ ...form, hasRepeatCustomers: value })} />
              <Check label="Может привести аудиторию" checked={form.canBringAudience} onChange={value => setForm({ ...form, canBringAudience: value })} />
            </div>
            <button style={styles.primary} type="submit">Добавить и проанализировать</button>
          </form>
        </div>

        <div style={styles.card}>
          <h2 style={styles.h2}>🧠 Очередь лидов</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {leads.length === 0 && <div style={styles.empty}>Добавь первый бизнес. Здесь появится приоритет и следующий шаг.</div>}
            {leads.map(lead => (
              <button key={lead.id} onClick={() => setSelectedId(lead.id)} style={{ ...styles.leadButton, borderColor: selected?.id === lead.id ? '#d8b75d' : '#303243' }}>
                <span><strong>{lead.name}</strong><br /><small style={styles.muted}>{SALES_STAGE_LABELS[lead.stage]}</small></span>
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
  header: { maxWidth: 1180, margin: '0 auto 18px' }, eyebrow: { color: '#d8b75d', fontWeight: 850, letterSpacing: '.08em', fontSize: 12 },
  h1: { margin: '6px 0 8px', fontSize: 'clamp(25px,4vw,42px)' }, h2: { margin: '0 0 14px', fontSize: 17 }, muted: { color: '#aeb1bf' },
  stats: { maxWidth: 1180, margin: '0 auto 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 },
  stat: { border: '1px solid #2d3040', background: '#151722', borderRadius: 16, padding: 14, display: 'grid', gap: 3 },
  grid: { maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14 },
  card: { border: '1px solid #2d3040', background: '#151722', borderRadius: 20, padding: 18 },
  input: { width: '100%', boxSizing: 'border-box', height: 42, borderRadius: 12, border: '1px solid #343748', background: '#0f111a', color: '#fff', padding: '0 11px' },
  checks: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 7 }, check: { color: '#c8cad3', fontSize: 13 },
  primary: { height: 42, border: 0, borderRadius: 12, background: '#d8b75d', color: '#15120a', fontWeight: 900, cursor: 'pointer' },
  leadButton: { width: '100%', border: '1px solid', background: '#10121b', color: '#fff', borderRadius: 14, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', cursor: 'pointer' },
  empty: { padding: 18, borderRadius: 14, background: '#10121b', color: '#858999' }, detailGrid: { display: 'grid', gridTemplateColumns: 'minmax(0,.8fr) minmax(0,1.2fr)', gap: 18 },
  scoreRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 20 }, label: { display: 'block', margin: '12px 0 6px', color: '#aeb1bf', fontSize: 12, fontWeight: 800 },
  textarea: { width: '100%', minHeight: 220, resize: 'vertical', boxSizing: 'border-box', borderRadius: 14, border: '1px solid #343748', background: '#0f111a', color: '#fff', padding: 12, lineHeight: 1.45 },
  nextAction: { marginTop: 12, borderRadius: 12, padding: 11, background: '#10121b', color: '#d8b75d', fontWeight: 750 }, notice: { marginTop: 10, color: '#9ca0ae', fontSize: 12, lineHeight: 1.45 },
};
