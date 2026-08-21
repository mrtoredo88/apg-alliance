import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../constants.js';
import { apgIdentity } from '../apg/index.js';

async function request(action, payload = {}) {
  const token = await apgIdentity.getSessionToken?.().catch(() => '');
  if (!token) throw new Error('Требуется административная авторизация.');
  const response = await fetch(`${API_BASE_URL}/api/sales-ai-agents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-apg-auth': token },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || 'Ошибка AI-агента.');
  return data;
}

async function loadLeads() {
  const token = await apgIdentity.getSessionToken?.().catch(() => '');
  if (!token) throw new Error('Требуется административная авторизация.');
  const response = await fetch(`${API_BASE_URL}/api/sales-ai`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-apg-auth': token },
    body: JSON.stringify({ action: 'list' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || 'Не удалось загрузить лиды.');
  return data.leads || [];
}

export function SalesAiAgentOps() {
  const [leads, setLeads] = useState([]);
  const [leadId, setLeadId] = useState('');
  const [messages, setMessages] = useState([]);
  const [summary, setSummary] = useState(null);
  const [direction, setDirection] = useState('inbound');
  const [channel, setChannel] = useState('manual');
  const [text, setText] = useState('');
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const selected = useMemo(() => leads.find(item => item.id === leadId) || null, [leads, leadId]);

  async function refreshAll() {
    try {
      const [rows, manager] = await Promise.all([loadLeads(), request('manager:summary')]);
      setLeads(rows);
      setLeadId(current => current || rows[0]?.id || '');
      setSummary(manager.summary || null);
    } catch (error) { setNotice(error.message); }
  }

  async function refreshMessages(id = leadId) {
    if (!id) return setMessages([]);
    try {
      const data = await request('communication:list', { leadId: id });
      setMessages(data.messages || []);
    } catch (error) { setNotice(error.message); }
  }

  useEffect(() => { refreshAll(); }, []);
  useEffect(() => { refreshMessages(leadId); setDraft(''); }, [leadId]);

  async function recordMessage() {
    if (!leadId || !text.trim()) return;
    try {
      const data = await request('communication:record', { leadId, direction, channel, text });
      setText('');
      setNotice(`Сообщение сохранено. Стадия лида: ${data.stage}.`);
      await Promise.all([refreshMessages(), refreshAll()]);
    } catch (error) { setNotice(error.message); }
  }

  async function makeDraft(mode) {
    if (!leadId) return;
    try {
      const data = await request('communication:draft', { leadId, mode });
      setDraft(data.draft || '');
      setNotice(mode === 'followup' ? 'Коммуникатор подготовил follow-up.' : 'Коммуникатор подготовил ответ.');
    } catch (error) { setNotice(error.message); }
  }

  async function runAgent(action, label) {
    if (!leadId) return;
    try {
      await request(action, { leadId });
      setNotice(`${label} обновил лид.`);
      await refreshAll();
    } catch (error) { setNotice(error.message); }
  }

  return (
    <main style={s.page}>
      <header style={s.header}>
        <div><div style={s.eyebrow}>АПГ · AI-отдел продаж</div><h1 style={s.h1}>Коммуникатор + Руководитель</h1><div style={s.muted}>Переписка фиксируется внутри воронки. AI готовит черновики, но ничего не отправляет без человека.</div></div>
        <div style={{display:'flex',gap:8}}><a href="/admin/sales-ai" style={s.link}>← Разведка</a><button onClick={refreshAll} style={s.button}>↻ Обновить</button></div>
      </header>
      {notice && <div style={s.notice}>{notice}</div>}
      <section style={s.stats}>
        <Stat label="Лидов" value={summary?.total || 0}/><Stat label="Приоритетных" value={summary?.highPriorityOpen || 0}/><Stat label="Follow-up" value={summary?.needsFollowup || 0}/><Stat label="Reply rate" value={`${summary?.conversion?.replyRate || 0}%`}/><Stat label="Meeting rate" value={`${summary?.conversion?.meetingRate || 0}%`}/><Stat label="Win rate" value={`${summary?.conversion?.winRate || 0}%`}/>
      </section>
      {!!summary?.priorities?.length && <section style={s.card}><h2 style={s.h2}>📊 Руководитель · что требует внимания</h2>{summary.priorities.map(item => <div key={item} style={s.priority}>• {item}</div>)}</section>}
      <section style={s.grid}>
        <div style={s.card}>
          <h2 style={s.h2}>🧠 Аналитик + ✍️ Продажник</h2>
          <select style={s.input} value={leadId} onChange={e=>setLeadId(e.target.value)}>{leads.map(lead=><option key={lead.id} value={lead.id}>{lead.name} · {lead.score || 0}/100 · {lead.stage}</option>)}</select>
          {selected && <div style={s.leadBox}><strong>{selected.name}</strong><div style={s.muted}>Score: {selected.score || 0}/100 · priority: {selected.priority || 'low'} · stage: {selected.stage}</div><div style={{marginTop:8}}>{selected.offerDraft || 'Оффер ещё не подготовлен.'}</div></div>}
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={s.button} onClick={()=>runAgent('analyst:refresh','Аналитик')}>Пересчитать score</button><button style={s.button} onClick={()=>runAgent('salesperson:refresh','Продажник')}>Обновить оффер</button></div>
        </div>
        <div style={s.card}>
          <h2 style={s.h2}>📬 Коммуникатор</h2>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><select style={s.input} value={direction} onChange={e=>setDirection(e.target.value)}><option value="inbound">Входящее</option><option value="outbound">Исходящее</option></select><select style={s.input} value={channel} onChange={e=>setChannel(e.target.value)}><option value="manual">Ручной канал</option><option value="email">Email</option><option value="telegram">Telegram</option><option value="vk">VK</option><option value="phone">Телефон</option></select></div>
          <textarea style={{...s.input,minHeight:120}} value={text} onChange={e=>setText(e.target.value)} placeholder="Вставь входящее сообщение или зафиксируй отправленное вручную" />
          <button style={s.primary} onClick={recordMessage}>Сохранить в переписку</button>
          <div style={{display:'flex',gap:8,marginTop:10}}><button style={s.button} onClick={()=>makeDraft('reply')}>Подготовить ответ</button><button style={s.button} onClick={()=>makeDraft('followup')}>Подготовить follow-up</button></div>
          {draft && <div style={s.draft}><div style={s.muted}>Черновик Коммуникатора</div><div style={{whiteSpace:'pre-wrap'}}>{draft}</div><button style={{...s.button,marginTop:8}} onClick={()=>setText(draft)}>Перенести в поле сообщения</button></div>}
        </div>
      </section>
      <section style={s.card}><h2 style={s.h2}>История переписки</h2>{messages.length===0?<div style={s.muted}>Сообщений пока нет.</div>:messages.map(m=><div key={m.id} style={s.message}><strong>{m.direction==='inbound'?'← Входящее':'→ Исходящее'} · {m.channel}</strong><div style={{whiteSpace:'pre-wrap',marginTop:4}}>{m.text}</div></div>)}</section>
    </main>
  );
}

function Stat({label,value}) { return <div style={s.stat}><div style={s.muted}>{label}</div><strong style={{fontSize:22}}>{value}</strong></div>; }

const s = {
  page:{minHeight:'100vh',padding:24,background:'#0d0e16',color:'#f7f4ea',fontFamily:'Inter,system-ui,sans-serif'},
  header:{display:'flex',justifyContent:'space-between',gap:20,alignItems:'flex-start',marginBottom:18},eyebrow:{fontSize:12,color:'#d8b75d',fontWeight:800,textTransform:'uppercase'},h1:{margin:'4px 0 6px',fontSize:30},h2:{margin:'0 0 12px',fontSize:18},muted:{color:'#aeb1bf',fontSize:13,lineHeight:1.45},notice:{padding:12,border:'1px solid #6a5a2d',background:'#211d12',borderRadius:12,marginBottom:16},stats:{display:'grid',gridTemplateColumns:'repeat(6,minmax(0,1fr))',gap:10,marginBottom:16},stat:{padding:14,border:'1px solid #2d3040',background:'#151722',borderRadius:14},grid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16},card:{padding:18,border:'1px solid #2d3040',background:'#151722',borderRadius:16,marginBottom:16},input:{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:10,border:'1px solid #343747',background:'#0f111a',color:'#fff',marginBottom:10},button:{padding:'9px 12px',borderRadius:10,border:'1px solid #494d61',background:'#202332',color:'#fff',cursor:'pointer'},primary:{padding:'10px 14px',borderRadius:10,border:'none',background:'#d8b75d',color:'#151515',fontWeight:800,cursor:'pointer'},link:{padding:'9px 12px',borderRadius:10,border:'1px solid #494d61',color:'#fff',textDecoration:'none'},leadBox:{padding:12,borderRadius:12,background:'#10121b',border:'1px solid #292c3a',marginBottom:10,lineHeight:1.5},draft:{marginTop:12,padding:12,borderRadius:12,background:'#10121b',border:'1px solid #6a5a2d',lineHeight:1.5},message:{padding:'10px 0',borderBottom:'1px solid #292c3a',lineHeight:1.45},priority:{padding:'5px 0'},
};
