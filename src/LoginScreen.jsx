import React from 'react';

const T = {
  bg:      '#0F0F1A',
  surface: '#1A1A2E',
  border:  'rgba(255,255,255,0.07)',
  gold:    '#C9A84C',
  goldL:   '#E8C97A',
  textPri: '#F0F0F0',
  textSec: 'rgba(240,240,240,0.5)',
};

const PERKS = [
  { icon: '🗝️', label: 'Ключи за каждый визит',       color: '#C9A84C' },
  { icon: '🎁', label: 'Акции только для участников',  color: '#4BB34B' },
  { icon: '🏆', label: 'Уровни и достижения',          color: '#4A90D9' },
  { icon: '📍', label: 'Лучшие места Зеленограда',     color: '#9B59B6' },
];

export function LoginScreen({ onLogin }) {
  return (
    <div style={{ position:'fixed', inset:0, background:T.bg, zIndex:500, display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* Фоновые орбы */}
      <div style={{ position:'absolute', top:-120, left:'50%', transform:'translateX(-50%)', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(201,168,76,0.1), transparent 65%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-80, right:-80, width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(74,144,217,0.07), transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(201,168,76,0.04) 1px, transparent 1px)', backgroundSize:'24px 24px', pointerEvents:'none' }} />

      {/* Верхняя часть — брендинг */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 28px', gap:32, position:'relative', zIndex:1 }}>

        {/* Логотип */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, animation:'fadeInUp 0.5s ease both' }}>
          <div style={{ position:'relative' }}>
            {/* Внешнее свечение */}
            <div style={{ position:'absolute', inset:-12, borderRadius:36, background:'radial-gradient(circle, rgba(201,168,76,0.18), transparent 70%)' }} />
            <div style={{ width:96, height:96, borderRadius:28, background:'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))', border:'1.5px solid rgba(201,168,76,0.4)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', boxShadow:'0 0 40px rgba(201,168,76,0.15), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                <polygon points="26,4 44,26 26,48 8,26" fill="rgba(201,168,76,0.08)" stroke="#C9A84C" strokeWidth="1.8" strokeLinejoin="round"/>
                <line x1="26" y1="4" x2="26" y2="48" stroke="rgba(201,168,76,0.25)" strokeWidth="1"/>
                <line x1="8" y1="26" x2="44" y2="26" stroke="rgba(201,168,76,0.25)" strokeWidth="1"/>
                <circle cx="26" cy="26" r="5" fill="#C9A84C"/>
                <circle cx="26" cy="26" r="2.5" fill="#0F0F1A"/>
              </svg>
            </div>
          </div>

          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:32, fontWeight:900, color:T.textPri, letterSpacing:4, lineHeight:1 }}>АПГ</div>
            <div style={{ fontSize:11, color:T.gold, fontWeight:700, letterSpacing:2.5, textTransform:'uppercase', marginTop:6 }}>Альянс Партнёров Города</div>
            <div style={{ fontSize:13, color:T.textSec, marginTop:10, lineHeight:'19px' }}>
              Программа лояльности лучших<br/>заведений Зеленограда
            </div>
          </div>
        </div>

        {/* Преимущества */}
        <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
          {PERKS.map((p, i) => (
            <div key={p.label} style={{ display:'flex', alignItems:'center', gap:14, background:'rgba(255,255,255,0.04)', border:`1px solid rgba(255,255,255,0.07)`, borderRadius:16, padding:'13px 16px', animation:'fadeInUp 0.45s ease both', animationDelay:`${0.1 + i * 0.07}s` }}>
              <div style={{ width:40, height:40, borderRadius:12, background:p.color+'18', border:`1px solid ${p.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                {p.icon}
              </div>
              <span style={{ fontSize:14, color:T.textPri, fontWeight:600 }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Нижняя часть — кнопка */}
      <div style={{ padding:'20px 28px 44px', position:'relative', zIndex:1, animation:'fadeInUp 0.5s ease 0.35s both' }}>
        <button
          onClick={onLogin}
          style={{ width:'100%', padding:'18px 0', borderRadius:18, border:'none', background:`linear-gradient(135deg, ${T.gold}, ${T.goldL})`, color:'#0F0F1A', fontSize:16, fontWeight:800, cursor:'pointer', letterSpacing:0.3, boxShadow:`0 6px 28px rgba(201,168,76,0.4), 0 2px 8px rgba(0,0,0,0.3)` }}
        >
          Войти через ВКонтакте
        </button>
        <div style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.18)', marginTop:12, lineHeight:'16px' }}>
          Используется ваш аккаунт ВКонтакте · Никакого пароля
        </div>
      </div>
    </div>
  );
}
