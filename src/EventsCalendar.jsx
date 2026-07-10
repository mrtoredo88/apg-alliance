import React, { useState, useMemo } from 'react';

const MONTHS_RU = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];
const MONTHS_GEN = [
  'января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря',
];
const DAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const WEEKDAYS_RU = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];

const CATEGORY_COLORS = {
  economy:   '#6AABEC',
  society:   '#A78BFA',
  sport:     '#4ade80',
  culture:   '#f59e0b',
  education: '#38bdf8',
  transport: '#fb923c',
};

function safeString(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

function safeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value?.toDate) {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getEventDate(ev) {
  if (!ev) return null;
  const startAt = safeDate(ev.startAt);
  if (startAt) return startAt;
  const eventDate = safeString(ev.eventDate);
  if (/^\d{4}-\d{2}-\d{2}/.test(eventDate)) return safeDate(eventDate.length === 10 ? `${eventDate}T12:00:00` : eventDate);
  const deadline = safeString(ev.deadline);
  if (/^\d{4}-\d{2}-\d{2}/.test(deadline)) return safeDate(deadline.length === 10 ? `${deadline}T12:00:00` : deadline);
  return null;
}

function toKey(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getEventTime(ev) {
  const d = safeDate(ev?.startAt);
  return d ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null;
}

function isPast(ev) {
  const d = getEventDate(ev);
  return d ? d < new Date() : false;
}

function formatDayLabel(date) {
  const d = safeDate(date);
  if (!d) return 'Без даты';
  const dow = safeString(WEEKDAYS_RU[d.getDay()]);
  const day = dow ? `${dow.slice(0, 1).toUpperCase()}${dow.slice(1)}` : 'День';
  const month = safeString(MONTHS_GEN[d.getMonth()]);
  return `${day}, ${d.getDate()}${month ? ` ${month}` : ''}`;
}

function buildDayWindows(events) {
  const list = Array.isArray(events) ? events.filter(Boolean) : [];
  const busy = new Set(list.map(ev => {
    const d = getEventDate(ev);
    return d ? d.getHours() : null;
  }).filter(v => v !== null));
  return [9, 12, 15, 18, 20].map(hour => {
    const event = list.find(ev => {
      const d = getEventDate(ev);
      return d && d.getHours() === hour;
    });
    return { hour, free: !busy.has(hour), event };
  });
}

const card = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(28px) saturate(1.6)',
  WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  marginBottom: 16,
};

function NavBtn({ onClick, children, A }) {
  return (
    <button onClick={onClick} style={{
      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 8, border: `1px solid ${A.border}`, background: 'rgba(255,255,255,0.05)',
      color: A.text, fontSize: 18, cursor: 'pointer', flexShrink: 0,
    }}>{children}</button>
  );
}

function StatCard({ icon, value, label, color, A }) {
  return (
    <div style={{ ...card, marginBottom: 0, padding: '14px 16px' }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: A.textSec, marginTop: 4, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function EventRow({ ev, onEventClick, A, showDate = false }) {
  const d = getEventDate(ev);
  const time = getEventTime(ev);
  const past = isPast(ev);
  const catColor = CATEGORY_COLORS[safeString(ev?.category)] || A.gold;
  const title = safeString(ev?.title, 'Событие без названия') || 'Событие без названия';
  const partner = safeString(ev?.partner || ev?.partnerName);
  const address = safeString(ev?.address);
  const registeredCount = Number(ev?.registeredCount ?? ev?.registrationsCount ?? 0) || 0;
  const maxParticipants = Number(ev?.maxParticipants ?? ev?.capacity ?? 0) || 0;
  return (
    <div
      onClick={() => onEventClick(ev)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', transition: 'background 0.12s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
        background: past ? 'rgba(255,255,255,0.04)' : 'rgba(201,168,76,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
      }}>{ev?.emoji || '🎉'}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: past ? A.textSec : A.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ev?.isPrivate ? '🔒 ' : ''}{title}
        </div>
        <div style={{ fontSize: 11, color: A.textSec, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {partner && <span>{partner}</span>}
          {address && <span>{partner ? ' · ' : ''}{address}</span>}
          {showDate && d && <span style={{ marginLeft: partner || address ? 6 : 0, color: past ? A.textSec : A.gold }}>
            · {d.getDate()} {safeString(MONTHS_GEN[d.getMonth()])}
          </span>}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {time && <div style={{ fontSize: 12, fontWeight: 700, color: past ? A.textSec : A.gold }}>{time}</div>}
        {registeredCount > 0 && (
          <div style={{ fontSize: 11, color: A.textSec, marginTop: 2 }}>
            {registeredCount}{maxParticipants > 0 ? ` / ${maxParticipants}` : ''} чел.
          </div>
        )}
      </div>

      <div style={{ width: 7, height: 7, borderRadius: '50%', background: catColor, flexShrink: 0 }} />
    </div>
  );
}

function FreeWindows({ date, events, onCreateEvent, A }) {
  const windows = buildDayWindows(events);
  return (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ color: A.text, fontSize: 14, fontWeight: 800 }}>Свободные окна</div>
          <div style={{ color: A.textSec, fontSize: 11, marginTop: 2 }}>{formatDayLabel(date)}</div>
        </div>
        <button onClick={onCreateEvent} style={{ padding: '7px 10px', borderRadius: 10, border: `1px solid ${A.goldBrd}`, background: 'rgba(201,168,76,0.12)', color: A.gold, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>+ Событие</button>
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
        {windows.map(item => (
          <div key={item.hour} style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 12, background: item.free ? 'rgba(75,179,75,0.08)' : 'rgba(201,168,76,0.10)', border: `1px solid ${item.free ? 'rgba(75,179,75,0.22)' : A.goldBrd}` }}>
            <div style={{ color: item.free ? '#4ade80' : A.gold, fontSize: 12, fontWeight: 900 }}>{String(item.hour).padStart(2, '0')}:00</div>
            <div style={{ color: item.free ? A.textSec : A.text, fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.free ? 'свободно' : (item.event?.title || 'мероприятие')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventsCalendar({ events = [], onEventClick, onCreateEvent, A }) {
  const safeEvents = Array.isArray(events) ? events.filter(Boolean) : [];
  const [view, setView] = useState('month');
  const [curMonth, setCurMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const todayKey = toKey(new Date());
  const today = new Date();

  const byDay = useMemo(() => {
    const m = {};
    safeEvents.forEach(ev => {
      const d = getEventDate(ev);
      if (!d) return;
      const k = toKey(d);
      if (!k) return;
      if (!m[k]) m[k] = [];
      m[k].push(ev);
    });
    return m;
  }, [safeEvents]);

  const statsToday = (byDay[todayKey] || []).length;

  const weekStart = useMemo(() => {
    const d = new Date(today);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekStart]);

  const statsWeek = useMemo(() => {
    return Object.entries(byDay).filter(([k]) => {
      const d = new Date(k + 'T12:00:00');
      return d >= weekStart && d <= weekEnd;
    }).reduce((s, [, a]) => s + a.length, 0);
  }, [byDay, weekStart, weekEnd]);

  const gridDays = useMemo(() => {
    const y = curMonth.getFullYear(), m = curMonth.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    let startDow = first.getDay();
    if (startDow === 0) startDow = 7;
    const pre = startDow - 1;
    const days = [];
    const prevLast = new Date(y, m, 0);
    for (let i = pre - 1; i >= 0; i--) {
      days.push({ date: new Date(y, m - 1, prevLast.getDate() - i), outside: true });
    }
    for (let d = 1; d <= last.getDate(); d++) {
      days.push({ date: new Date(y, m, d), outside: false });
    }
    const rem = 42 - days.length;
    for (let d = 1; d <= rem; d++) {
      days.push({ date: new Date(y, m + 1, d), outside: true });
    }
    return days;
  }, [curMonth]);

  const filteredEvents = useMemo(() => {
    let r = safeEvents;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(e =>
        safeString(e?.title).toLowerCase().includes(q) ||
        safeString(e?.address).toLowerCase().includes(q) ||
        safeString(e?.partner || e?.partnerName).toLowerCase().includes(q) ||
        safeString(e?.expert || e?.expertName).toLowerCase().includes(q) ||
        safeString(e?.category).toLowerCase().includes(q) ||
        safeString(e?.status).toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'upcoming') r = r.filter(e => !isPast(e));
    else if (statusFilter === 'past') r = r.filter(e => isPast(e));
    else if (statusFilter === 'nodate') r = r.filter(e => !getEventDate(e));
    return [...r].sort((a, b) => {
      const da = getEventDate(a), db = getEventDate(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
  }, [safeEvents, search, statusFilter]);

  const groups = useMemo(() => {
    const result = [];
    let curKey = null;
    filteredEvents.forEach(ev => {
      const d = getEventDate(ev);
      const k = d ? toKey(d) : '__nodate__';
      const label = d ? formatDayLabel(d) : 'Без даты';
      if (k !== curKey) { result.push({ key: k, label, list: [] }); curKey = k; }
      result[result.length - 1].list.push(ev);
    });
    return result;
  }, [filteredEvents]);

  const selKey = selectedDay ? toKey(selectedDay) : null;
  const selEvents = selKey ? (byDay[selKey] || []) : [];

  const prevMonth = () => setCurMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => {
    const n = new Date();
    setCurMonth(new Date(n.getFullYear(), n.getMonth(), 1));
    setSelectedDay(n);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#F0F0F0' }}>Центр событий</h1>
        <span style={{ fontSize: 13, color: A.textSec }}>управление мероприятиями</span>
      </div>

      {/* Статистика */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard icon="🎉" value={safeEvents.length} label="Всего событий" color={A.gold} A={A} />
        <StatCard icon="📅" value={statsToday} label="Сегодня" color="#4ade80" A={A} />
        <StatCard icon="📆" value={statsWeek} label="На этой неделе" color="#38bdf8" A={A} />
        <StatCard icon="🗓️" value={Object.keys(byDay).length} label="Дней с событиями" color="#A78BFA" A={A} />
      </div>

      {/* Управление: навигация + переключатель + кнопка */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={goToday} style={{
          padding: '8px 14px', borderRadius: 10, border: `1px solid ${A.border}`,
          background: 'rgba(255,255,255,0.05)', color: A.text, fontSize: 13, cursor: 'pointer', fontWeight: 600,
        }}>Сегодня</button>

        {view === 'month' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <NavBtn onClick={prevMonth} A={A}>‹</NavBtn>
            <span style={{ fontSize: 15, fontWeight: 700, color: A.text, minWidth: 168, textAlign: 'center' }}>
              {MONTHS_RU[curMonth.getMonth()]} {curMonth.getFullYear()}
            </span>
            <NavBtn onClick={nextMonth} A={A}>›</NavBtn>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3 }}>
          {[['month', 'Месяц'], ['list', 'Список']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: view === v ? 700 : 400, fontSize: 13,
              background: view === v ? A.gold : 'transparent',
              color: view === v ? '#1A1208' : A.textSec,
              transition: 'all 0.15s',
            }}>{l}</button>
          ))}
        </div>

        <button onClick={onCreateEvent} style={{
          padding: '8px 18px', borderRadius: 10, border: 'none',
          background: A.gold, color: '#1A1208', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>+ Событие</button>
      </div>

      {/* Вид: Месяц */}
      {view === 'month' && (
        <>
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            {/* Заголовок дней недели */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${A.border}` }}>
              {DAYS_SHORT.map((d, i) => (
                <div key={d} style={{
                  padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700,
                  color: i >= 5 ? A.gold : A.textSec, letterSpacing: 0.5,
                }}>{d}</div>
              ))}
            </div>

            {/* Ячейки дней */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {gridDays.map((item, idx) => {
                const k = toKey(item.date);
                const dayEvs = byDay[k] || [];
                const isToday = k === todayKey;
                const isSelected = k === selKey;
                const isWeekend = item.date.getDay() === 0 || item.date.getDay() === 6;
                const showDots = dayEvs.slice(0, 5);
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDay(isSelected ? null : item.date)}
                    style={{
                      minHeight: 76, padding: '8px 7px',
                      borderRight: idx % 7 !== 6 ? `1px solid ${A.border}` : 'none',
                      borderBottom: idx < 35 ? `1px solid ${A.border}` : 'none',
                      background: isSelected
                        ? 'rgba(201,168,76,0.09)'
                        : item.outside ? 'rgba(0,0,0,0.10)' : 'transparent',
                      cursor: 'pointer', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'rgba(201,168,76,0.09)' : item.outside ? 'rgba(0,0,0,0.10)' : 'transparent'; }}
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: isToday ? 800 : 500,
                      color: item.outside
                        ? (A.textSec + '60')
                        : isToday ? '#1A1208'
                        : isWeekend ? A.gold : A.text,
                      background: isToday ? A.gold : 'transparent',
                      marginBottom: 5,
                    }}>{item.date.getDate()}</div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {showDots.map((ev, di) => (
                        <div key={di} style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: CATEGORY_COLORS[safeString(ev?.category)] || A.gold,
                          opacity: item.outside ? 0.4 : 1,
                          flexShrink: 0,
                        }} />
                      ))}
                      {dayEvs.length > 5 && (
                        <div style={{ fontSize: 9, color: A.textSec, lineHeight: '7px', paddingTop: 1 }}>
                          +{dayEvs.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Легенда категорий */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16, paddingLeft: 4 }}>
            {Object.entries(CATEGORY_COLORS).map(([id, color]) => {
              const labels = { economy:'Экономика', society:'Общество', sport:'Спорт', culture:'Культура', education:'Образование', transport:'Транспорт' };
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: A.textSec }}>{labels[id]}</span>
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: A.gold, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: A.textSec }}>Без категории</span>
            </div>
          </div>

          {/* Список событий выбранного дня */}
          {selectedDay && selEvents.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 14, alignItems: 'start' }}>
              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: `1px solid ${A.border}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: A.text }}>
                    {formatDayLabel(selectedDay)}
                    {toKey(selectedDay) === todayKey && (
                      <span style={{ marginLeft: 8, background: A.gold, color: '#1A1208', borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>Сегодня</span>
                    )}
                  </div>
                  <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', color: A.textSec, cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}>✕</button>
                </div>
                {selEvents.map((ev, i) => (
                  <div key={ev?.id || i} style={{ borderBottom: i < selEvents.length - 1 ? `1px solid ${A.border}` : 'none' }}>
                    <EventRow ev={ev} onEventClick={onEventClick} A={A} />
                  </div>
                ))}
              </div>
              <FreeWindows date={selectedDay} events={selEvents} onCreateEvent={onCreateEvent} A={A} />
            </div>
          )}

          {selectedDay && selEvents.length === 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 14, alignItems: 'start' }}>
              <div style={{ ...card, padding: '28px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: A.text, marginBottom: 6 }}>
                  {formatDayLabel(selectedDay)}
                </div>
                <div style={{ fontSize: 13, color: A.textSec, marginBottom: 16 }}>В этот день нет событий</div>
                <button onClick={onCreateEvent} style={{
                  padding: '9px 20px', borderRadius: 10, border: 'none',
                  background: A.gold, color: '#1A1208', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>+ Создать событие на этот день</button>
              </div>
              <FreeWindows date={selectedDay} events={[]} onCreateEvent={onCreateEvent} A={A} />
            </div>
          )}
        </>
      )}

      {/* Вид: Список */}
      {view === 'list' && (
        <div>
          {/* Поиск и фильтры */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{
              flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.1)`,
              borderRadius: 12, padding: '8px 12px',
            }}>
              <span style={{ color: A.textSec, flexShrink: 0 }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по названию, адресу, партнёру..."
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: A.text, flex: 1, minWidth: 0 }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: A.textSec, cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['all','Все'],['upcoming','Предстоящие'],['past','Прошедшие'],['nodate','Без даты']].map(([v, l]) => (
                <button key={v} onClick={() => setStatusFilter(v)} style={{
                  padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: statusFilter === v ? 700 : 400, cursor: 'pointer',
                  border: `1px solid ${statusFilter === v ? A.gold : A.border}`,
                  background: statusFilter === v ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                  color: statusFilter === v ? A.gold : A.textSec,
                  transition: 'all 0.15s',
                }}>{l}</button>
              ))}
            </div>
          </div>

          {filteredEvents.length === 0 && (
            <div style={{ textAlign: 'center', padding: '56px 0', color: A.textSec }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: A.text, marginBottom: 6 }}>Событий не найдено</div>
              <div style={{ fontSize: 13 }}>Попробуйте другой запрос или фильтр</div>
            </div>
          )}

          {groups.map(g => (
            <div key={g.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 8px 2px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: A.gold, letterSpacing: 0.7, textTransform: 'uppercase' }}>
                  {g.label}
                </div>
                {g.key === todayKey && (
                  <span style={{ background: A.gold, color: '#1A1208', borderRadius: 6, padding: '1px 7px', fontSize: 10, fontWeight: 900 }}>Сегодня</span>
                )}
                <div style={{ flex: 1, height: 1, background: A.border }} />
                <span style={{ fontSize: 11, color: A.textSec }}>{g.list.length} {g.list.length === 1 ? 'событие' : g.list.length < 5 ? 'события' : 'событий'}</span>
              </div>

              <div style={{ ...card, padding: 0, marginBottom: 8, overflow: 'hidden' }}>
                {g.list.map((ev, i) => (
                  <div key={ev?.id || i} style={{ borderBottom: i < g.list.length - 1 ? `1px solid ${A.border}` : 'none' }}>
                    <EventRow ev={ev} onEventClick={onEventClick} A={A} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
