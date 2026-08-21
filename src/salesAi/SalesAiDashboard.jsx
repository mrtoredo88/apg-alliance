import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../constants.js';
import { apgIdentity } from '../apg/index.js';
import { enrichLead, nextBestAction, SALES_STAGE_LABELS, SALES_STAGES, summarizePipeline } from './salesAgentCore.js';

const initialForm = {
  name: '', category: 'food', website: '', vk: '', telegram: '', email: '', telegramChatId: '', vkPeerId: '', contact: '', city: 'Зеленоград', district: '', source: '', sourceUrl: '',
  local: true, hasOfflinePoint: true, activeSocials: true, runsEvents: false,
  hasRepeatCustomers: true, canBringAudience: true, decisionMakerFound: false,
};

const initialScoutTask = { city: 'Зеленоград', district: '', category: 'food', query: '', limit: 10 };

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

async function salesAgentRequest(action, payload = {}) {
  const token = await apgIdentity.getSessionToken?.().catch(() => '');
  if (!token) throw new Error('Требуется административная авторизация.');
  const response = await fetch(`${API_BASE_URL}/api/sales-ai-agents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-apg-auth': token },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || 'Не удалось отправить сообщение.');
    error.code = data.code;
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
  const [scoutTask, setScoutTask] = useState(initialScoutTask);
  const [scoutCandidates, setScoutCandidates] = useState([]);
  const [scoutLoading, setScoutLoading] = useState(false);
  const [scoutProvider, setScoutProvider] = useState('');
  const [copiedLeadId, setCopiedLeadId] = useState(null);
  const [leadQuery, setLeadQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const stats = useMemo(() => summarizePipeline(leads), [leads]);
  const selected = leads.find(lead => lead.id === selectedId) || leads[0] || null;
  const filteredLeads = useMemo(() => {
    const query = leadQuery.trim().toLowerCase();
    return leads.filter(lead => {
      const matchesQuery = !query || [lead.name, lead.city, lead.district, lead.email, lead.contact].some(value => String(value || '').toLowerCase().includes(query));
      const matchesStage = stageFilter === 'all' || lead.stage === stageFilter || (stageFilter === 'ready' && Boolean(lead.email || lead.vkPeerId || lead.telegramChatId));
      return matchesQuery && matchesStage;
    });
  }, [leads, leadQuery, stageFilter]);

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

  const loadScoutQueue = async () => {
    try {
      const data = await salesRequest('scout:list', { status: 'pending' });
      setScoutCandidates(Array.isArray(data.candidates) ? data.candidates : []);
    } catch (error) {
      setNotice(`Очередь Scout не загрузилась: ${error.message}`);
    }
  };

  useEffect(() => { loadLeads(); loadScoutQueue(); }, []);

  const runScout = async event => {
    event?.preventDefault?.();
    if (scoutLoading) return;
    setScoutLoading(true); setNotice('Scout ищет подходящие компании и проверяет дубли…');
    try {
      const data = await salesRequest('scout:search', { task: scoutTask });
      setScoutProvider(data.provider || '');
      await loadScoutQueue();
      setNotice(`Scout завершил поиск: в очередь добавлено ${data.candidates?.length || 0}, дублей пропущено ${data.skippedDuplicates || 0}.`);
    } catch (error) {
      if (error.code === 'sales-ai/scout-provider-unconfigured') {
        setNotice('Scout готов, но на сервере ещё не задан BRAVE_SEARCH_API_KEY. После добавления ключа поиск заработает без изменений интерфейса.');
      } else {
        setNotice(`Scout не смог выполнить поиск: ${error.message}`);
      }
    } finally {
      setScoutLoading(false);
    }
  };

  const approveScoutCandidate = async candidate => {
    if (busy) return;
    setBusy(true); setNotice('Передаю кандидата Аналитику…');
    try {
      const prepared = enrichLead({
        ...candidate,
        local: true,
        hasOfflinePoint: true,
        activeSocials: Boolean(candidate.vk || candidate.telegram || candidate.website),
        runsEvents: false,
        hasRepeatCustomers: true,
        canBringAudience: true,
        decisionMakerFound: false,
      });
      const data = await salesRequest('scout:approve', { id: candidate.id, lead: prepared });
      setScoutCandidates(current => current.filter(item => item.id !== candidate.id));
      setLeads(current => [data.lead, ...current]);
      setSelectedId(data.lead.id);
      setNotice(`${candidate.name} принят: Аналитик поставил ${data.lead.score}/100 и Продажник подготовил оффер.`);
    } catch (error) {
      if (error.code === 'sales-ai/duplicate' && error.duplicate?.id) {
        setScoutCandidates(current => current.filter(item => item.id !== candidate.id));
        setSelectedId(error.duplicate.id);
        setNotice(`Scout-кандидат оказался дублем: ${error.duplicate.name || 'существующий лид'}.`);
      } else {
        setNotice(`Не удалось принять кандидата: ${error.message}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const dismissScoutCandidate = async candidate => {
    if (busy) return;
    setBusy(true);
    try {
      await salesRequest('scout:dismiss', { id: candidate.id });
      setScoutCandidates(current => current.filter(item => item.id !== candidate.id));
      setNotice(`${candidate.name} убран из очереди Scout.`);
    } catch (error) {
      setNotice(`Не удалось отклонить кандидата: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

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

  const copyOffer = async lead => {
    const text = String(lead?.offerDraft || '').trim();
    if (!text) {
      setNotice('У этого лида пока нет текста предложения.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLeadId(lead.id);
      setNotice(`Текст для «${lead.name}» скопирован. Вставь его в сообщение компании, отправь и затем отметь лид как «Связались».`);
      window.setTimeout(() => setCopiedLeadId(current => current === lead.id ? null : current), 3000);
    } catch {
      setNotice('Браузер не разрешил копирование. Выдели текст в поле предложения и скопируй его через ⌘C.');
    }
  };

  const sendOfferAutomatically = async lead => {
    if (busy || !lead?.offerDraft) return;
    if (!window.confirm(`Отправить предложение для «${lead.name}» через первый доступный канал?`)) return;
    setBusy(true);
    setNotice(`Проверяю доступные каналы для «${lead.name}»…`);
    try {
      const data = await salesAgentRequest('communication:send', { leadId: lead.id, text: lead.offerDraft, channel: 'auto' });
      setLeads(current => current.map(item => item.id === lead.id ? { ...item, stage: data.stage, lastOutreachChannel: data.delivery?.channel } : item));
      setNotice(`Сообщение для «${lead.name}» отправлено через ${data.delivery?.channel || 'доступный канал'}. Статус изменён на «Связались».`);
    } catch (error) {
      setNotice(error.code === 'sales-ai/no-outreach-channel'
        ? 'Автоотправка недоступна: добавь email, VK peer ID или Telegram chat ID в карточку лида.'
        : `Автоотправка не выполнена: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  const enrichOneContact = async lead => {
    if (busy || !lead) return;
    setBusy(true);
    setNotice(`Ищу открытые контакты для «${lead.name}»…`);
    try {
      const data = await salesAgentRequest('contacts:enrich', { leadId: lead.id });
      setLeads(current => current.map(item => item.id === lead.id ? data.lead : item));
      setNotice(data.found?.length
        ? `Для «${lead.name}» обновлены: ${data.found.join(', ')}. Сообщения не отправлялись.`
        : `Для «${lead.name}» открытые контакты не найдены. Сообщения не отправлялись.`);
    } catch (error) {
      setNotice(`Не удалось проверить контакты «${lead.name}»: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  const enrichAllContacts = async () => {
    if (busy || !leads.length) return;
    const targets = leads.filter(lead => !lead.email && !lead.vkPeerId && !lead.telegramChatId);
    if (!targets.length) {
      setNotice('У всех лидов уже есть цифровой адресат для автоотправки.');
      return;
    }
    setBusy(true);
    let cursor = 0;
    let completed = 0;
    let enriched = 0;
    const updates = new Map();
    const worker = async () => {
      while (cursor < targets.length) {
        const lead = targets[cursor++];
        try {
          const data = await salesAgentRequest('contacts:enrich', { leadId: lead.id });
          updates.set(lead.id, data.lead);
          if (data.found?.length) enriched += 1;
        } catch (error) {
          updates.set(lead.id, { ...lead, contactEnrichmentError: error.message });
        }
        completed += 1;
        setNotice(`Собираю контакты: ${completed} из ${targets.length}…`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, targets.length) }, () => worker()));
    setLeads(current => current.map(lead => updates.get(lead.id) || lead));
    setNotice(`Повторная разведка завершена: проверено ${targets.length}, контакты найдены или подтверждены у ${enriched}. Сообщения не отправлялись.`);
    setBusy(false);
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>АПГ · AI-отдел продаж</div>
          <h1 style={styles.h1}>Разведка → анализ → оффер → контакт → результат</h1>
          <p style={styles.muted}>Scout находит кандидатов, ты подтверждаешь, после чего Аналитик и Продажник подхватывают лид автоматически.</p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" onClick={enrichAllContacts} disabled={busy || loading} style={styles.primarySmall}>{busy ? 'Собираю контакты…' : 'Найти контакты у всех лидов'}</button>
          <button type="button" onClick={() => { loadLeads(); loadScoutQueue(); }} disabled={loading} style={styles.secondary}>{loading ? 'Загрузка…' : '↻ Обновить'}</button>
        </div>
      </header>

      {notice && <div style={styles.noticeTop}>{notice}</div>}

      <section style={styles.stats}>
        <Stat label="Лидов" value={stats.total} />
        <Stat label="Scout очередь" value={scoutCandidates.length} />
        <Stat label="Приоритетных" value={stats.highPriority} />
        <Stat label="Ответов" value={stats.replied} />
        <Stat label="Встреч" value={stats.meetings} />
        <Stat label="Партнёров" value={stats.won} />
      </section>

      <section style={styles.grid}>
        <div style={styles.fullCard}>
          <div style={styles.scoutHead}>
            <div>
              <h2 style={styles.h2}>🔎 Scout · автоматическая разведка</h2>
              <div style={styles.muted}>Задай район и категорию. Scout ищет публичные источники, сохраняет доказательства и складывает кандидатов сюда, но сам никому не пишет.</div>
            </div>
            {scoutProvider && <span style={styles.providerBadge}>provider: {scoutProvider}</span>}
          </div>
          <form onSubmit={runScout} style={styles.scoutForm}>
            <input style={styles.input} value={scoutTask.city} onChange={e => setScoutTask({ ...scoutTask, city: e.target.value })} placeholder="Город" />
            <input style={styles.input} value={scoutTask.district} onChange={e => setScoutTask({ ...scoutTask, district: e.target.value })} placeholder="Район / локация" />
            <select style={styles.input} value={scoutTask.category} onChange={e => setScoutTask({ ...scoutTask, category: e.target.value })}>
              <option value="food">Еда</option><option value="beauty">Красота</option><option value="sport">Спорт</option>
              <option value="education">Образование</option><option value="entertainment">Развлечения</option>
              <option value="health">Здоровье</option><option value="pets">Животные</option><option value="services">Услуги</option><option value="other">Другое</option>
            </select>
            <input style={styles.input} value={scoutTask.query} onChange={e => setScoutTask({ ...scoutTask, query: e.target.value })} placeholder="Доп. условие, например: семейные, премиум…" />
            <select style={styles.input} value={scoutTask.limit} onChange={e => setScoutTask({ ...scoutTask, limit: Number(e.target.value) })}>
              {[5, 10, 20].map(value => <option key={value} value={value}>{value} кандидатов</option>)}
            </select>
            <button type="submit" style={styles.primary} disabled={scoutLoading}>{scoutLoading ? 'Scout ищет…' : 'Запустить разведку'}</button>
          </form>

          <div style={styles.candidateGrid}>
            {scoutCandidates.length === 0 && <div style={styles.empty}>Очередь Scout пуста. После поиска найденные компании появятся здесь для проверки.</div>}
            {scoutCandidates.map(candidate => (
              <div key={candidate.id} style={styles.candidateCard}>
                <div style={styles.candidateTop}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 14 }}>{candidate.name}</strong>
                    <div style={styles.meta}>{[candidate.city, candidate.district, candidate.category].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span style={confidenceStyle(candidate.confidence)}>{Math.round(Number(candidate.confidence || 0) * 100)}%</span>
                </div>
                {candidate.snippet && <div style={styles.snippet}>{candidate.snippet}</div>}
                <div style={styles.meta}>{candidate.sourceUrl || candidate.website || candidate.vk || candidate.telegram}</div>
                {!!candidate.evidence?.length && <div style={styles.evidence}>Evidence: {candidate.evidence.slice(0, 3).map(item => item.field).join(' · ')}</div>}
                <div style={styles.candidateActions}>
                  <button type="button" style={styles.secondary} disabled={busy} onClick={() => dismissScoutCandidate(candidate)}>Не подходит</button>
                  <button type="button" style={styles.primarySmall} disabled={busy} onClick={() => approveScoutCandidate(candidate)}>Принять → Аналитик</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.workspace}>
          <aside style={styles.leadSidebar}>
            <div style={styles.sidebarHead}>
              <div><h2 style={styles.h2}>Лиды</h2><div style={styles.meta}>Показано {filteredLeads.length} из {leads.length}</div></div>
            </div>
            <input style={styles.input} value={leadQuery} onChange={e => setLeadQuery(e.target.value)} placeholder="Поиск по названию или контакту" />
            <div style={styles.filterRow}>
              {[['all', 'Все'], ['offer_ready', 'Оффер готов'], ['ready', 'Есть адресат'], ['contacted', 'Связались']].map(([value, label]) => (
                <button type="button" key={value} onClick={() => setStageFilter(value)} style={stageFilter === value ? styles.filterActive : styles.filterButton}>{label}</button>
              ))}
            </div>
            <div style={styles.leadList}>
              {loading && <div style={styles.empty}>Загружаю лиды…</div>}
              {!loading && filteredLeads.length === 0 && <div style={styles.empty}>По этому фильтру лидов нет.</div>}
              {filteredLeads.map(lead => {
                const hasRecipient = Boolean(lead.email || lead.vkPeerId || lead.telegramChatId);
                const hasPublicContact = Boolean(lead.email || lead.vk || lead.telegram || lead.contact || lead.website);
                return (
                  <button key={lead.id} onClick={() => setSelectedId(lead.id)} style={{ ...styles.leadButton, borderColor: selected?.id === lead.id ? '#d8b75d' : '#303243', background: selected?.id === lead.id ? '#1b1b20' : '#10121b' }}>
                    <span style={{ minWidth: 0 }}><strong>{lead.name}</strong><br /><small style={styles.muted}>{SALES_STAGE_LABELS[lead.stage] || lead.stage}</small><div style={styles.badgeRow}><span style={hasPublicContact ? styles.goodBadge : styles.dimBadge}>{hasPublicContact ? 'контакты' : 'нет контактов'}</span><span style={hasRecipient ? styles.goodBadge : styles.warnBadge}>{hasRecipient ? 'готов к отправке' : 'нужен адресат'}</span></div></span>
                    <span style={scoreStyle(lead.priority)}>{lead.score}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section style={styles.leadDetail}>
            {!selected ? <div style={styles.empty}>Выбери лид, чтобы увидеть анализ и предложение.</div> : (
              <>
                <div style={styles.detailHeader}>
                  <div><div style={styles.scoreRow}><span style={scoreStyle(selected.priority)}>{selected.score}/100</span><strong>{selected.name}</strong></div><div style={styles.meta}>{[selected.city, selected.district, SALES_STAGE_LABELS[selected.stage]].filter(Boolean).join(' · ')}</div></div>
                  <button type="button" style={styles.secondary} disabled={busy} onClick={() => enrichOneContact(selected)}>Обновить контакты</button>
                </div>
                <div style={styles.detailGrid}>
                  <div>
                    <h3 style={styles.sectionTitle}>Анализ</h3>
                    <p style={styles.muted}>{selected.reasons?.join(' · ') || 'Недостаточно сигналов для подробной оценки'}</p>
                    {(selected.source || selected.sourceUrl) && <div style={styles.meta}>Источник: {selected.source || 'не указан'}{selected.sourceUrl ? ` · ${selected.sourceUrl}` : ''}</div>}
                    {selected.confidence != null && <div style={styles.meta}>Scout confidence: {Math.round(Number(selected.confidence) * 100)}%</div>}
                    <h3 style={styles.sectionTitle}>Контакты</h3>
                    {(selected.email || selected.vk || selected.telegram || selected.contact || selected.website)
                      ? <div style={styles.contactStack}>{[['Email', selected.email], ['Телефон', selected.contact], ['Сайт', selected.website], ['VK', selected.vk], ['Telegram', selected.telegram]].filter(([, value]) => value).map(([label, value]) => <div key={label}><span style={styles.contactLabel}>{label}</span><span style={styles.contactValue}>{value}</span></div>)}</div>
                      : <div style={styles.emptyCompact}>Открытые контакты пока не найдены.</div>}
                    {selected.contactEnrichedAt && <div style={styles.meta}>Проверено: {new Date(selected.contactEnrichedAt).toLocaleString('ru-RU')} · {selected.contactEnrichmentSource || 'источник не найден'}</div>}
                    {selected.contactEnrichmentSource?.includes('openstreetmap') && <div style={styles.meta}>Данные: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={styles.inlineLink}>© OpenStreetMap contributors</a></div>}
                    <details style={styles.advancedBox}>
                      <summary style={styles.summary}>Настройки каналов</summary>
                      <div style={styles.channelFields} key={selected.id}>
                        <input style={styles.input} type="email" defaultValue={selected.email || ''} placeholder="Email" onBlur={e => { if (e.target.value !== (selected.email || '')) updateLead(selected.id, { email: e.target.value }); }} />
                        <input style={styles.input} defaultValue={selected.vkPeerId || ''} placeholder="VK peer ID" onBlur={e => { if (e.target.value !== (selected.vkPeerId || '')) updateLead(selected.id, { vkPeerId: e.target.value }); }} />
                        <input style={styles.input} defaultValue={selected.telegramChatId || ''} placeholder="Telegram chat ID" onBlur={e => { if (e.target.value !== (selected.telegramChatId || '')) updateLead(selected.id, { telegramChatId: e.target.value }); }} />
                      </div>
                    </details>
                    <label style={styles.label}>Статус</label>
                    <select style={styles.input} value={selected.stage} onChange={e => updateLead(selected.id, { stage: e.target.value })}>{SALES_STAGES.map(stage => <option key={stage} value={stage}>{SALES_STAGE_LABELS[stage]}</option>)}</select>
                    <div style={styles.nextAction}>Следующий шаг: {nextBestAction(selected)}</div>
                  </div>
                  <div style={styles.offerPane}>
                    <h3 style={styles.sectionTitle}>Предложение</h3>
                    <textarea style={styles.textarea} value={selected.offerDraft || ''} onChange={e => updateLead(selected.id, { offerDraft: e.target.value })} />
                    <div style={styles.offerActions}>
                      <button type="button" style={styles.primary} disabled={busy || selected.stage !== 'offer_ready'} onClick={() => sendOfferAutomatically(selected)}>{busy ? 'Подождите…' : 'Отправить автоматически'}</button>
                      <button type="button" style={styles.secondary} onClick={() => copyOffer(selected)}>{copiedLeadId === selected.id ? '✓ Скопировано' : 'Скопировать'}</button>
                      {selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer" style={styles.linkButton}>Источник</a>}
                    </div>
                    <div style={styles.notice}>Автоотправка использует первый доступный адресат и не дублирует сообщение. Ручной способ: скопировать текст, отправить и изменить статус на «Связались».</div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        <details style={styles.manualCard}>
          <summary style={styles.manualSummary}>➕ Добавить лид вручную</summary>
          <form onSubmit={addLead} style={styles.manualForm}>
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
            <input style={styles.input} type="email" placeholder="Email для предложения" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <div style={styles.twoCols}>
              <input style={styles.input} placeholder="VK peer ID" value={form.vkPeerId} onChange={e => setForm({ ...form, vkPeerId: e.target.value })} />
              <input style={styles.input} placeholder="Telegram chat ID" value={form.telegramChatId} onChange={e => setForm({ ...form, telegramChatId: e.target.value })} />
            </div>
            <input style={styles.input} placeholder="Контакт / ЛПР" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value, decisionMakerFound: Boolean(e.target.value.trim()) })} />
            <div style={styles.twoCols}>
              <input style={styles.input} placeholder="Источник" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />
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
        </details>
      </section>
    </main>
  );
}

function Stat({ label, value }) { return <div style={styles.stat}><strong style={{ fontSize: 26 }}>{value}</strong><span style={styles.muted}>{label}</span></div>; }
function Check({ label, checked, onChange }) { return <label style={styles.check}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /> {label}</label>; }
function scoreStyle(priority) { return { minWidth: 46, height: 34, padding: '0 9px', borderRadius: 12, display: 'inline-grid', placeItems: 'center', fontWeight: 900, background: priority === 'high' ? '#294b32' : priority === 'medium' ? '#4b4229' : '#3c3446', color: '#fff' }; }
function confidenceStyle(value) { const n = Number(value || 0); return { padding: '5px 8px', borderRadius: 999, fontSize: 11, fontWeight: 900, color: n >= 0.75 ? '#71d58b' : n >= 0.55 ? '#e8c76d' : '#d0a7ff', background: '#10121b', border: '1px solid #303243', flexShrink: 0 }; }

const styles = {
  page: { minHeight: '100vh', background: '#0d0e16', color: '#f7f4ea', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' },
  header: { maxWidth: 1180, margin: '0 auto 18px', display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' },
  headerActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  eyebrow: { color: '#d8b75d', fontWeight: 850, letterSpacing: '.08em', fontSize: 12 },
  h1: { margin: '6px 0 8px', fontSize: 'clamp(25px,4vw,42px)' }, h2: { margin: '0 0 10px', fontSize: 17 }, muted: { color: '#aeb1bf' },
  noticeTop: { maxWidth: 1180, margin: '0 auto 12px', padding: '10px 12px', borderRadius: 12, background: '#181b28', border: '1px solid #343748', color: '#d8b75d', fontSize: 12 },
  stats: { maxWidth: 1180, margin: '0 auto 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 },
  stat: { border: '1px solid #2d3040', background: '#151722', borderRadius: 16, padding: 14, display: 'grid', gap: 3 },
  grid: { maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 14 },
  card: { border: '1px solid #2d3040', background: '#151722', borderRadius: 20, padding: 18, minWidth: 0 },
  fullCard: { gridColumn: '1 / -1', border: '1px solid #2d3040', background: '#151722', borderRadius: 20, padding: 18, minWidth: 0 },
  workspace: { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', border: '1px solid #2d3040', background: '#151722', borderRadius: 20, overflow: 'hidden', minHeight: 620 },
  leadSidebar: { padding: 16, borderRight: '1px solid #2d3040', minWidth: 0, background: '#12141d' },
  sidebarHead: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', marginBottom: 10 },
  filterRow: { display: 'flex', gap: 6, margin: '10px 0', flexWrap: 'wrap' },
  filterButton: { border: '1px solid #303243', background: '#10121b', color: '#9ca0ae', borderRadius: 999, padding: '6px 9px', fontSize: 11, cursor: 'pointer' },
  filterActive: { border: '1px solid #d8b75d', background: '#4b4229', color: '#fff', borderRadius: 999, padding: '6px 9px', fontSize: 11, cursor: 'pointer' },
  leadList: { display: 'grid', gap: 7, maxHeight: 510, overflowY: 'auto', paddingRight: 3 },
  leadDetail: { padding: 20, minWidth: 0 },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingBottom: 15, marginBottom: 4, borderBottom: '1px solid #292c3a', flexWrap: 'wrap' },
  sectionTitle: { margin: '16px 0 8px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', color: '#d8b75d' },
  badgeRow: { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 },
  goodBadge: { borderRadius: 999, padding: '3px 6px', background: '#1f3d2a', color: '#82d99a', fontSize: 9, fontWeight: 800 },
  warnBadge: { borderRadius: 999, padding: '3px 6px', background: '#493b25', color: '#e8c76d', fontSize: 9, fontWeight: 800 },
  dimBadge: { borderRadius: 999, padding: '3px 6px', background: '#252735', color: '#858999', fontSize: 9, fontWeight: 800 },
  contactStack: { display: 'grid', gap: 7, padding: 11, borderRadius: 12, background: '#10121b', border: '1px solid #292c3a', marginBottom: 8 },
  contactLabel: { display: 'inline-block', minWidth: 72, color: '#858999', fontSize: 10, textTransform: 'uppercase' },
  contactValue: { color: '#e6e2d8', fontSize: 12, wordBreak: 'break-all' },
  emptyCompact: { padding: 11, borderRadius: 12, background: '#10121b', color: '#858999', fontSize: 12 },
  advancedBox: { marginTop: 10, border: '1px solid #292c3a', borderRadius: 12, padding: '9px 10px' },
  summary: { cursor: 'pointer', color: '#aeb1bf', fontSize: 12, fontWeight: 750 },
  offerPane: { minWidth: 0, borderLeft: '1px solid #292c3a', paddingLeft: 18 },
  manualCard: { gridColumn: '1 / -1', border: '1px solid #2d3040', background: '#151722', borderRadius: 16, padding: 15 },
  manualSummary: { cursor: 'pointer', color: '#d8b75d', fontWeight: 850 },
  manualForm: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginTop: 14 },
  input: { width: '100%', boxSizing: 'border-box', height: 42, borderRadius: 12, border: '1px solid #343748', background: '#0f111a', color: '#fff', padding: '0 11px' },
  twoCols: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 },
  checks: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 7 }, check: { color: '#c8cad3', fontSize: 13 },
  primary: { minHeight: 42, border: 0, borderRadius: 12, background: '#d8b75d', color: '#15120a', padding: '0 14px', fontWeight: 900, cursor: 'pointer' },
  primarySmall: { minHeight: 36, border: 0, borderRadius: 10, background: '#d8b75d', color: '#15120a', padding: '0 11px', fontWeight: 900, cursor: 'pointer' },
  secondary: { minHeight: 36, borderRadius: 10, border: '1px solid #343748', background: '#151722', color: '#d8b75d', padding: '0 11px', cursor: 'pointer' },
  scoutHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  providerBadge: { padding: '5px 9px', borderRadius: 999, border: '1px solid #343748', background: '#10121b', color: '#858999', fontSize: 10 },
  scoutForm: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginTop: 14 },
  candidateGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 10, marginTop: 14 },
  candidateCard: { padding: 13, borderRadius: 15, background: '#10121b', border: '1px solid #303243', minWidth: 0 },
  candidateTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  candidateActions: { display: 'flex', justifyContent: 'flex-end', gap: 7, marginTop: 11, flexWrap: 'wrap' },
  snippet: { color: '#b9bcc8', fontSize: 12, lineHeight: '17px', margin: '9px 0' },
  evidence: { marginTop: 7, color: '#d8b75d', fontSize: 10.5 },
  leadButton: { width: '100%', border: '1px solid', background: '#10121b', color: '#fff', borderRadius: 14, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', cursor: 'pointer', gap: 10 },
  empty: { padding: 18, borderRadius: 14, background: '#10121b', color: '#858999' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,330px),1fr))', gap: 18 },
  channelFields: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 7 },
  contactSummary: { marginTop: 8, padding: 9, borderRadius: 10, background: '#10121b', color: '#c8cad3', fontSize: 11, wordBreak: 'break-word' },
  scoreRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 20 }, label: { display: 'block', margin: '12px 0 6px', color: '#aeb1bf', fontSize: 12, fontWeight: 800 }, meta: { fontSize: 11, color: '#858999', wordBreak: 'break-word', marginTop: 5 },
  textarea: { width: '100%', minHeight: 220, resize: 'vertical', boxSizing: 'border-box', borderRadius: 14, border: '1px solid #343748', background: '#0f111a', color: '#fff', padding: 12, lineHeight: 1.45 },
  offerActions: { display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  linkButton: { minHeight: 36, borderRadius: 10, border: '1px solid #343748', background: '#151722', color: '#d8b75d', padding: '0 11px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none', fontSize: 13 },
  inlineLink: { color: '#d8b75d', textDecoration: 'underline' },
  nextAction: { marginTop: 12, borderRadius: 12, padding: 11, background: '#10121b', color: '#d8b75d', fontWeight: 750 }, notice: { marginTop: 10, color: '#9ca0ae', fontSize: 12, lineHeight: 1.45 },
};
