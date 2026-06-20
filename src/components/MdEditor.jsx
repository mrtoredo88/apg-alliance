import React, { useRef } from 'react';

const BTN = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  color: '#F0F0F0',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  padding: '4px 10px',
  lineHeight: 1.5,
  flexShrink: 0,
};

export function MdEditor({ value, onChange, placeholder, style }) {
  const taRef = useRef(null);

  const applyBold = () => {
    const ta = taRef.current;
    if (!ta) return;
    const s   = ta.selectionStart;
    const e   = ta.selectionEnd;
    const sel = value.slice(s, e) || 'жирный';
    const next = value.slice(0, s) + `**${sel}**` + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + 2, s + 2 + sel.length);
    });
  };

  const applyBullet = () => {
    const ta = taRef.current;
    if (!ta) return;
    const s         = ta.selectionStart;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const line      = value.slice(lineStart, s);
    if (line.startsWith('- ')) {
      const next = value.slice(0, lineStart) + line.slice(2) + value.slice(s);
      onChange(next);
      requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s - 2, s - 2); });
    } else {
      const next = value.slice(0, lineStart) + '- ' + value.slice(lineStart);
      onChange(next);
      requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + 2, s + 2); });
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <button type="button" onMouseDown={e => { e.preventDefault(); applyBold(); }} style={BTN}>
          <strong>Ж</strong>
        </button>
        <button type="button" onMouseDown={e => { e.preventDefault(); applyBullet(); }} style={BTN}>
          • список
        </button>
        <span style={{ fontSize: 10, color: 'rgba(240,240,240,0.28)', marginLeft: 2 }}>
          **жирный**&nbsp;· - пункт
        </span>
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={style}
      />
    </div>
  );
}
