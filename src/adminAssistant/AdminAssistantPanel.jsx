import React, { useEffect, useMemo, useRef, useState } from 'react';
import { answerAdminCommand, buildAdminInsights, sectionKnowledge } from './AdminAssistantEngine.js';

const STORAGE_KEY = 'apg_admin_assistant_v1';

function loadSettings() {
  try {
    return { collapsed: false, pinned: true, width: 360, side: 'right', ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { collapsed: false, pinned: true, width: 360, side: 'right' };
  }
}

function saveSettings(settings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
}

export function AdminAssistantPanel({ context, theme, compact, onNavigate }) {
  const [settings, setSettings] = useState(loadSettings);
  const [input, setInput] = useState('');
  const [answer, setAnswer] = useState(null);
  const inputRef = useRef(null);
  const previousSectionRef = useRef(context.section);
  const insights = useMemo(() => buildAdminInsights(context), [context]);
  const knowledge = useMemo(() => sectionKnowledge(context.section), [context.section]);
  const visibleInsights = context.section === 'dashboard' ? insights.summary : insights.current;

  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { setAnswer(null); }, [context.section, context.filters, context.search, context.selected]);
  useEffect(() => {
    if (previousSectionRef.current !== context.section && !settings.pinned) setSettings(prev => ({ ...prev, collapsed: true }));
    previousSectionRef.current = context.section;
  }, [context.section, settings.pinned]);

  const updateSettings = patch => setSettings(prev => ({ ...prev, ...patch }));
  const submit = event => {
    event?.preventDefault?.();
    if (!input.trim()) return;
    setAnswer(answerAdminCommand(input, context, insights));
    setInput('');
  };
  const panelWidth = compact ? 'calc(100vw - 24px)' : settings.width;
  const positionStyle = compact
    ? { position: 'fixed', left: 12, right: 12, bottom: 12 }
    : { position: 'relative', margin: '18px 18px 18px 0', alignSelf: 'stretch', flexShrink: 0 };

  return (
    <aside style={{
      ...positionStyle, zIndex: 880, width: panelWidth,
      maxHeight: settings.collapsed ? 58 : compact ? 'min(520px, calc(100svh - 118px))' : 'min(660px, calc(100svh - 36px))',
      overflow: 'hidden', borderRadius: 22, border: `1px solid ${theme.goldBrd}`,
      background: 'rgba(15,15,31,0.96)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
      boxShadow: '0 22px 72px rgba(0,0,0,0.52)', color: theme.text,
    }} aria-label="Admin Assistant">
      <div style={{ minHeight: 58, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9, borderBottom: settings.collapsed ? 'none' : `1px solid ${theme.border}` }}>
        <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 13, background: 'linear-gradient(135deg, rgba(201,168,76,0.34), rgba(232,199,109,0.10))', border: `1px solid ${theme.goldBrd}`, display: 'grid', placeItems: 'center', fontSize: 19 }}>◌</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 850, color: theme.gold }}>Локи · Admin Assistant</div>
          <div style={{ fontSize: 10.5, color: theme.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{knowledge.title} · {context.role}</div>
        </div>
        <button type="button" onClick={() => updateSettings({ pinned: !settings.pinned })} title={settings.pinned ? 'Открепить' : 'Закрепить'} style={{ ...iconButton(theme), color: settings.pinned ? theme.gold : theme.textSec }}>⌖</button>
        <button type="button" onClick={() => updateSettings({ collapsed: !settings.collapsed })} aria-label={settings.collapsed ? 'Развернуть' : 'Свернуть'} style={iconButton(theme)}>{settings.collapsed ? '▴' : '▾'}</button>
      </div>

      {!settings.collapsed && (
        <div style={{ padding: 12, overflowY: 'auto', maxHeight: compact ? 'calc(100svh - 176px)' : 'calc(100svh - 94px)' }}>
          <div style={{ padding: 11, borderRadius: 15, background: 'rgba(255,255,255,0.045)', border: `1px solid ${theme.border}`, fontSize: 11.5, lineHeight: '17px', color: theme.textSec }}>
            {knowledge.description}
            {context.loadedAt && <div style={{ marginTop: 5, fontSize: 10, opacity: 0.72 }}>Данные загружены: {new Date(context.loadedAt).toLocaleString('ru-RU')}</div>}
          </div>

          <div style={{ marginTop: 11, display: 'grid', gap: 7 }}>
            {visibleInsights.length ? visibleInsights.map(row => (
              <button key={row.id} type="button" onClick={() => onNavigate(row.tab)} style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 13, border: `1px solid ${row.priority === 'high' && row.count ? 'rgba(230,70,70,0.34)' : theme.border}`, background: row.priority === 'high' && row.count ? 'rgba(230,70,70,0.08)' : 'rgba(255,255,255,0.035)', color: theme.text, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', gap: 9, alignItems: 'center' }}>
                <span style={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 10, background: row.count ? 'rgba(201,168,76,0.14)' : 'rgba(75,179,75,0.10)', color: row.count ? theme.gold : '#4BB34B', fontWeight: 850, fontSize: 12 }}>{row.count}</span>
                <span style={{ flex: 1, fontSize: 11.5, lineHeight: '15px', fontWeight: 700 }}>{row.label}</span>
                <span style={{ color: theme.textSec, fontSize: 13 }}>›</span>
              </button>
            )) : <div style={{ color: theme.textSec, fontSize: 11.5 }}>Для этого раздела доступны справка и контекстные команды. Дополнительных фактов из загруженных данных нет.</div>}
          </div>

          {answer && (
            <div style={{ marginTop: 11, padding: 11, borderRadius: 15, background: 'rgba(201,168,76,0.08)', border: `1px solid ${theme.goldBrd}` }}>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 11.5, lineHeight: '17px' }}>{answer.text}</div>
              {!!answer.actions?.length && <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>{answer.actions.map(action => <button key={`${action.label}-${action.tab}`} type="button" onClick={() => onNavigate(action.tab)} style={{ padding: '7px 10px', borderRadius: 10, border: `1px solid ${theme.goldBrd}`, background: 'rgba(201,168,76,0.14)', color: theme.gold, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{action.label}</button>)}</div>}
            </div>
          )}

          <form onSubmit={submit} style={{ marginTop: 11, display: 'flex', gap: 7 }}>
            <input ref={inputRef} value={input} onChange={event => setInput(event.target.value)} placeholder="Спросить по данным админки..." style={{ flex: 1, minWidth: 0, height: 38, borderRadius: 12, border: `1px solid ${theme.border}`, background: 'rgba(255,255,255,0.05)', color: theme.text, padding: '0 11px', fontSize: 11.5, fontFamily: 'inherit', outline: 'none' }} />
            <button type="submit" disabled={!input.trim()} style={{ width: 40, height: 38, borderRadius: 12, border: `1px solid ${theme.goldBrd}`, background: 'rgba(201,168,76,0.18)', color: theme.gold, fontSize: 17, cursor: input.trim() ? 'pointer' : 'default', opacity: input.trim() ? 1 : 0.45 }}>↑</button>
          </form>

          {!compact && (
            <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: theme.textSec }}>Размер</span>
              <input type="range" min="320" max="520" step="20" value={settings.width} onChange={event => updateSettings({ width: Number(event.target.value) })} style={{ flex: 1, accentColor: theme.gold }} />
              <span style={{ fontSize: 10, color: theme.textSec }}>{settings.width}px</span>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function iconButton(theme) {
  return { width: 30, height: 30, padding: 0, flexShrink: 0, borderRadius: 10, border: `1px solid ${theme.border}`, background: 'rgba(255,255,255,0.045)', color: theme.textSec, cursor: 'pointer', fontFamily: 'inherit' };
}
