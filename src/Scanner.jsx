import React, { useEffect, useRef } from 'react';
import vkBridge from '@vkontakte/vk-bridge';

export default function Scanner({ isOpen, onClose, mapPlaces, onConfirm }) {
  const triggered = useRef(false);

  useEffect(() => {
    if (!isOpen) { triggered.current = false; return; }
    if (triggered.current) return;
    triggered.current = true;

    vkBridge.send('VKWebAppOpenCodeReader')
      .then(({ code_data }) => {
        if (code_data) onConfirm?.(code_data);
        else onClose?.();
      })
      .catch(() => onClose?.());
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  // В dev-режиме VKWebAppOpenCodeReader не работает — показываем список партнёров
  const isDev = import.meta.env.MODE === 'development';
  if (!isDev) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(9,9,13,0.7)',
        zIndex: 2000,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 48, height: 48,
          border: '3px solid rgba(201,168,76,0.3)',
          borderTopColor: '#C9A84C',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Открываем сканер…</div>
      </div>
    );
  }

  // Dev fallback — список партнёров для тестирования
  const safePlaces = Array.isArray(mapPlaces) ? mapPlaces : [];
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(9,9,13,0.97)',
      zIndex: 2000,
      display: 'flex', flexDirection: 'column',
      padding: '24px 20px',
      overflowY: 'auto',
    }}>
      <div style={{
        color: 'rgba(201,168,76,0.8)', fontSize: 11,
        fontWeight: 700, letterSpacing: 2,
        textTransform: 'uppercase', marginBottom: 16,
      }}>
        DEV — выбрать партнёра
      </div>
      {safePlaces.map(place => (
        <button
          key={place.id}
          onClick={() => onConfirm?.(place.id)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#F0F0F0', padding: '14px 16px',
            borderRadius: 12, marginBottom: 8,
            cursor: 'pointer', fontSize: 14, fontWeight: 600,
            textAlign: 'left',
          }}
        >
          {place.icon} {place.name}
        </button>
      ))}
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(240,240,240,0.4)',
          marginTop: 12, padding: '14px',
          borderRadius: 12, cursor: 'pointer', fontSize: 14,
        }}
      >
        Отмена
      </button>
    </div>
  );
}
