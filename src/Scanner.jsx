import React from 'react';

export const Scanner = ({ isOpen, onClose, mapPlaces, onConfirm }) => {
  if (!isOpen) return null;
  
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(9, 9, 13, 0.95)', zIndex: 1000,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px'
    }}>
      <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>📷 Сканер Альянса</h3>
      
      {mapPlaces.map(place => (
        <button 
          key={place.id}
          onClick={() => onConfirm(place.name)}
          style={{
            background: '#161625', border: '1px solid rgba(255,255,255,0.05)',
            color: '#fff', padding: '12px', borderRadius: '12px',
            marginBottom: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600'
          }}
        >
          {place.icon} {place.name}
        </button>
      ))}

      <button 
        onClick={onClose}
        style={{ background: 'none', border: 'none', color: '#ff007f', marginTop: '20px', cursor: 'pointer', fontWeight: 'bold' }}
      >
        ❌ Закрыть сканер
      </button>
    </div>
  );
};