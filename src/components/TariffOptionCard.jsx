import React, { useState } from 'react';
import { T } from '../design.js';

export function TariffOptionCard({ item, selected, disabled = false, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const interactive = !disabled;
  const elevated = selected || hovered || focused;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => interactive && onSelect?.(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setPressed(false); }}
      style={{
        width: '100%',
        padding: 13,
        borderRadius: 15,
        border: `1px solid ${selected ? T.gold : focused ? T.goldL : T.border}`,
        backgroundColor: hovered && !selected ? T.surface2 : T.surface,
        backgroundImage: selected ? `linear-gradient(135deg, color-mix(in srgb, ${T.gold} 22%, transparent), transparent)` : 'none',
        color: T.textPri,
        textAlign: 'left',
        cursor: interactive ? 'pointer' : 'not-allowed',
        fontFamily: 'inherit',
        opacity: disabled ? 0.54 : 1,
        outline: focused ? `2px solid ${T.goldL}` : 'none',
        outlineOffset: 2,
        boxShadow: elevated ? '0 10px 28px rgba(31,28,18,0.10)' : 'none',
        transform: pressed ? 'translateY(1px)' : 'none',
        transition: 'background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 80ms ease, opacity 160ms ease',
      }}
    >
      <span style={{ display: 'block', color: T.textPri, fontSize: 15, lineHeight: '20px', fontWeight: 950 }}>
        {item.label}
      </span>
      {item.price && (
        <span style={{ display: 'block', marginTop: 3, color: selected ? T.gold : T.textPri, fontSize: 13, lineHeight: '18px', fontWeight: 900 }}>
          {item.price}
        </span>
      )}
      <span style={{ display: 'block', marginTop: 4, color: T.textSec, fontSize: 11.5, lineHeight: '17px', fontWeight: 650 }}>
        {item.description}
      </span>
      {Array.isArray(item.features) && item.features.length > 0 && (
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
          {item.features.map(feature => (
            <span
              key={feature}
              style={{
                borderRadius: 999,
                padding: '4px 8px',
                background: selected ? `color-mix(in srgb, ${T.gold} 18%, transparent)` : T.chipBg,
                border: `1px solid ${selected ? T.gold : T.chipBorder}`,
                color: selected ? T.textPri : T.chipText,
                fontSize: 10.5,
                lineHeight: '14px',
                fontWeight: 850,
              }}
            >
              {feature}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
