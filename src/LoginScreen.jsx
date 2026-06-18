import React, { useState } from 'react';

const T = {
  bg:      '#0F0F1A',
  gold:    '#C9A84C',
  goldL:   '#E8C97A',
  textPri: '#F0F0F0',
  textSec: 'rgba(240,240,240,0.5)',
};

const VK_APP_URL = 'https://vk.com/app54601851';

// Opens VK app via Universal Links (iOS) or Intent URL (Android)
function openVKApp() {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);

  if (isAndroid) {
    window.location.href =
      'intent://vk.com/app54601851#Intent;scheme=https;package=com.vkontakte.android;' +
      'S.browser_fallback_url=' + encodeURIComponent(VK_APP_URL) + ';end';
    return;
  }

  // iOS + desktop: https Universal Link — iOS opens in VK app if installed
  window.location.href = VK_APP_URL;
}

const PERKS = [
  { icon: '🗝️', label: 'Ключи за каждый визит',       color: '#C9A84C' },
  { icon: '🎁', label: 'Акции только для участников',  color: '#4BB34B' },
  { icon: '🏆', label: 'Уровни и достижения',          color: '#4A90D9' },
  { icon: '📍', label: 'Лучшие места Зеленограда',     color: '#9B59B6' },
];

export function LoginScreen({ onLogin, onWebLogin, isWebMode = false }) {
  const [showNameInput, setShowNameInput] = useState(false);
  const [name, setName] = useState('');

  const handleWebSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onWebLogin(trimmed);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:T.bg, zIndex:500, display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* Фоновые орбы */}
      <div style={{ position:'absolute', top:-120, left:'50%', transform:'translateX(-50%)', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(201,168,76,0.1), transparent 65%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-80, right:-80, width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(74,144,217,0.07), transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(201,168,76,0.04) 1px, transparent 1px)', backgroundSize:'24px 24px', pointerEvents:'none' }} />

      {/* Верхняя часть — брендинг */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 28px', gap:28, position:'relative', zIndex:1 }}>

        {/* Логотип */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, animation:'fadeInUp 0.5s ease both' }}>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', inset:-16, borderRadius:'50%', background:'radial-gradient(circle, rgba(201,168,76,0.18), transparent 70%)' }} />
            <img
              src="/logo.png"
              alt="АПГ"
              style={{ width:160, height:160, borderRadius:32, display:'block', position:'relative', boxShadow:'0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.2)' }}
            />
          </div>

          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:13, color:T.textSec, lineHeight:'19px' }}>
              Программа лояльности лучших<br/>заведений Зеленограда
            </div>
          </div>
        </div>

        {/* Преимущества */}
        <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
          {PERKS.map((p, i) => (
            <div key={p.label} style={{ display:'flex', alignItems:'center', gap:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'13px 16px', animation:'fadeInUp 0.45s ease both', animationDelay:`${0.1 + i * 0.07}s` }}>
              <div style={{ width:40, height:40, borderRadius:12, background:p.color+'18', border:`1px solid ${p.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                {p.icon}
              </div>
              <span style={{ fontSize:14, color:T.textPri, fontWeight:600 }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Нижняя часть */}
      <div style={{ padding:'20px 28px 44px', position:'relative', zIndex:1, animation:'fadeInUp 0.5s ease 0.35s both' }}>
        {isWebMode ? (
          !showNameInput ? (
            <>
              {/* Основная кнопка — открыть в ВК */}
              <button
                onClick={openVKApp}
                style={{ width:'100%', padding:'18px 0', borderRadius:18, border:'none', background:'linear-gradient(135deg, #2787F5, #1565C0)', color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', letterSpacing:0.3, boxShadow:'0 6px 28px rgba(39,135,245,0.4)', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:10 }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.019-1.304.583-1.496c.595-.19 1.361 1.26 2.174 1.815.614.418 1.08.326 1.08.326l2.17-.03s1.134-.071.597-.964c-.044-.073-.314-.665-1.621-1.879-1.368-1.271-1.184-1.066.463-3.267.998-1.334 1.397-2.148 1.272-2.495-.12-.331-.852-.243-.852-.243l-2.442.015s-.181-.025-.315.056c-.132.08-.217.267-.217.267s-.387 1.041-.903 1.927c-1.088 1.86-1.524 1.96-1.702 1.844-.414-.269-.311-1.077-.311-1.652 0-1.797.271-2.546-.528-2.739-.265-.065-.46-.107-1.137-.114-.869-.009-1.603.003-2.019.207-.276.136-.49.439-.36.456.161.022.525.099.719.364.249.344.24 1.115.24 1.115s.143 2.115-.333 2.378c-.327.178-.776-.185-1.739-1.846-.494-.857-.868-1.805-.868-1.805s-.072-.18-.202-.277c-.157-.116-.376-.153-.376-.153l-2.322.015s-.348.01-.476.163c-.114.136-.009.417-.009.417s1.818 4.27 3.877 6.421c1.888 1.974 4.031 1.843 4.031 1.843h.97z"/>
                </svg>
                Открыть в ВКонтакте
              </button>

              {/* Разделитель */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }} />
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.25)' }}>или</span>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }} />
              </div>

              {/* Демо-версия */}
              <button
                onClick={() => setShowNameInput(true)}
                style={{ width:'100%', padding:'16px 0', borderRadius:18, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:T.textSec, fontSize:14, fontWeight:700, cursor:'pointer', letterSpacing:0.2 }}
              >
                Посмотреть демо-версию
              </button>

              <div style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.18)', marginTop:12, lineHeight:'16px' }}>
                Полный функционал доступен в приложении ВКонтакте
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setShowNameInput(false)} style={{ background:'none', border:'none', color:T.textSec, fontSize:13, cursor:'pointer', padding:'0 0 14px', display:'flex', alignItems:'center', gap:4 }}>
                ← Назад
              </button>
              <div style={{ fontSize:13, color:T.textSec, textAlign:'center', marginBottom:14, lineHeight:'18px' }}>
                Введите имя для демо-доступа
              </div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleWebSubmit()}
                placeholder="Ваше имя"
                autoFocus
                style={{ width:'100%', padding:'16px 18px', borderRadius:16, border:`1.5px solid ${name.trim() ? T.gold + '80' : 'rgba(255,255,255,0.1)'}`, background:'rgba(255,255,255,0.05)', color:T.textPri, fontSize:16, fontWeight:600, boxSizing:'border-box', outline:'none', marginBottom:12, transition:'border-color 0.2s' }}
              />
              <button
                onClick={handleWebSubmit}
                disabled={!name.trim()}
                style={{ width:'100%', padding:'18px 0', borderRadius:18, border:'none', background: name.trim() ? `linear-gradient(135deg, ${T.gold}, ${T.goldL})` : 'rgba(255,255,255,0.08)', color: name.trim() ? '#0F0F1A' : T.textSec, fontSize:16, fontWeight:800, cursor: name.trim() ? 'pointer' : 'default', letterSpacing:0.3, boxShadow: name.trim() ? `0 6px 28px rgba(201,168,76,0.4)` : 'none', transition:'all 0.2s' }}
              >
                Войти в демо
              </button>
              <div style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.18)', marginTop:12, lineHeight:'16px' }}>
                Демо-данные не синхронизируются с ВКонтакте
              </div>
            </>
          )
        ) : (
          <>
            <button
              onClick={onLogin}
              style={{ width:'100%', padding:'18px 0', borderRadius:18, border:'none', background:`linear-gradient(135deg, ${T.gold}, ${T.goldL})`, color:'#0F0F1A', fontSize:16, fontWeight:800, cursor:'pointer', letterSpacing:0.3, boxShadow:`0 6px 28px rgba(201,168,76,0.4), 0 2px 8px rgba(0,0,0,0.3)` }}
            >
              Войти через ВКонтакте
            </button>
            <div style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.18)', marginTop:12, lineHeight:'16px' }}>
              Используется ваш аккаунт ВКонтакте · Никакого пароля
            </div>
          </>
        )}
      </div>
    </div>
  );
}
