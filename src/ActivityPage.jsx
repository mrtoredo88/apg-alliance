import React, { useState, useEffect } from 'react';
import { Panel } from '@vkontakte/vkui';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

import { T, GLASS } from './design.js';

const TYPE_COLORS = {
  scan:           '#C9A84C',
  favorite_add:   '#4BB34B',
  favorite_remove:'#E64646',
};

function relativeTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'только что';
  if (mins  < 60) return `${mins} мин назад`;
  if (hours < 24) return `${hours} ч назад`;
  if (days  === 1) return 'вчера';
  if (days  < 7)  return `${days} дн назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function dayLabel(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString())     return 'Сегодня';
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function groupByDay(items) {
  const groups = [];
  let lastLabel = null;
  items.forEach(item => {
    const label = dayLabel(item.ts);
    if (label !== lastLabel) {
      groups.push({ label, items: [] });
      lastLabel = label;
    }
    groups[groups.length - 1].items.push(item);
  });
  return groups;
}

function ActivityItem({ item, index }) {
  const color = TYPE_COLORS[item.type] ?? T.gold;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      borderBottom: `1px solid ${T.border}`,
      animation: 'fadeInUp 0.35s ease both',
      animationDelay: `${index * 0.04}s`,
    }}>
      {/* Иконка */}
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: color + '18', border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>
        {item.icon ?? '📌'}
      </div>

      {/* Текст */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: T.textPri,
          lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.text}
        </div>
        <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>
          {relativeTime(item.ts)}
        </div>
      </div>

      {/* Цветная точка */}
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}88` }} />
    </div>
  );
}

export function ActivityPage({ nav, userId, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || userId === 'guest') { setLoading(false); return; }
    const fetch = async () => {
      try {
        const q = query(
          collection(db, 'users', String(userId), 'activity'),
          orderBy('ts', 'desc'),
          limit(100),
        );
        const snap = await getDocs(q);
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [userId]);

  const groups = groupByDay(items);

  return (
    <Panel id={nav}>
      <div style={{ position: 'sticky', top: 'var(--safe-top, 0px)', zIndex: 50, background: 'rgba(8,8,20,0.72)', backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri, lineHeight: 1.2 }}>✦ История активности</div>
            {!loading && items.length > 0 && <div style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>{items.length} записей</div>}
          </div>
        </div>
      </div>

      <div style={{ background: T.bg, minHeight: '100%', paddingBottom: 80 }}>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 280, flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'relative', width: 60, height: 60 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(201,168,76,0.12)', borderTopColor: '#C9A84C', animation: 'spin 1.2s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: T.gold, animation: 'pulse-glow 2s ease-in-out infinite' }}>✦</div>
            </div>
            <span style={{ color: T.textSec, fontSize: 14 }}>Загружаем историю...</span>
          </div>
        ) : items.length === 0 ? (
          <div style={{ margin: '32px 16px', ...GLASS, borderRadius: 24, padding: '36px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ animation: 'float 3.5s ease-in-out infinite' }}>
              <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                <circle cx="45" cy="45" r="38" fill="rgba(201,168,76,0.05)" stroke="rgba(201,168,76,0.2)" strokeWidth="1.5"/>
                <rect x="28" y="25" width="34" height="42" rx="7" fill="rgba(201,168,76,0.07)" stroke="rgba(201,168,76,0.25)" strokeWidth="1.5"/>
                <line x1="35" y1="36" x2="55" y2="36" stroke="rgba(201,168,76,0.4)" strokeWidth="2" strokeLinecap="round"/>
                <line x1="35" y1="44" x2="55" y2="44" stroke="rgba(201,168,76,0.25)" strokeWidth="2" strokeLinecap="round"/>
                <line x1="35" y1="52" x2="47" y2="52" stroke="rgba(201,168,76,0.2)" strokeWidth="2" strokeLinecap="round"/>
                <rect x="72" y="10" width="5" height="5" rx="0.5" transform="rotate(45 74 12)" fill="rgba(201,168,76,0.5)"/>
                <rect x="8" y="68" width="4" height="4" rx="0.5" transform="rotate(45 10 70)" fill="rgba(201,168,76,0.3)"/>
              </svg>
            </div>
            <div>
              <div style={{ color: T.textPri, fontWeight: 700, fontSize: 15, marginBottom: 5 }}>История пуста</div>
              <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px' }}>Посещай партнёров и добавляй их в избранное — всё появится здесь</div>
            </div>
          </div>
        ) : (
          <>
            {/* Итого */}
            <div style={{ padding: '12px 16px 4px', display: 'flex', gap: 8 }}>
              {[
                { label: 'Визитов', value: items.filter(i => i.type === 'scan').length, color: T.gold },
                { label: 'В избранное', value: items.filter(i => i.type === 'favorite_add').length, color: T.green },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</span>
                  <span style={{ fontSize: 11, color: T.textSec }}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* Сгруппированный список */}
            {groups.map(group => (
              <div key={group.label} style={{ marginTop: 16 }}>
                <div style={{ padding: '0 16px 8px', fontSize: 11, fontWeight: 700, color: T.textSec, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {group.label}
                </div>
                <div style={{ ...GLASS, borderRadius: 24, margin: '0 16px', overflow: 'hidden' }}>
                  {group.items.map((item, i) => (
                    <ActivityItem key={item.id} item={item} index={i} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Panel>
  );
}
