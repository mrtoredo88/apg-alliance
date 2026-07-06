import React, { useState } from 'react';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard, GlassInput } from './components/Apg2ProfileGlass.jsx';

const T = {
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
    <div style={{ position:'fixed', inset:0, background:APG2_PROFILE.bg, zIndex:500, display:'flex', flexDirection:'column', overflow:'hidden', color: APG2_PROFILE.text }}>

      {/* Фоновые орбы */}
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 50% -8%,rgba(215,184,106,0.18),transparent 34%), radial-gradient(circle at 100% 18%,rgba(73,61,118,0.18),transparent 34%)', pointerEvents:'none' }} />

      {/* Верхняя часть — брендинг */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'calc(18px + env(safe-area-inset-top, 0px)) 24px 0', gap:20, position:'relative', zIndex:1 }}>

        {/* Логотип */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, animation:'fadeInUp 0.5s ease both' }}>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', inset:-18, borderRadius:42, background:'radial-gradient(circle, rgba(215,184,106,0.26), transparent 68%)' }} />
            <picture>
              <source srcSet="/logo.webp" type="image/webp" />
              <img
                src="/logo.png"
                alt="АПГ"
                style={{ width:128, height:128, borderRadius:34, display:'block', position:'relative', boxShadow:'0 28px 80px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,255,255,0.18)' }}
              />
            </picture>
          </div>

          <div style={{ textAlign:'center' }}>
            <GlassBadge tone="gold" style={{ marginBottom: 14 }}>АПГ 2.0</GlassBadge>
            <div style={{ fontSize:30, lineHeight:'34px', fontWeight:880, color:APG2_PROFILE.text, marginBottom:10, letterSpacing: 0 }}>
              Город внутри<br/>одного приложения
            </div>
            <div style={{ fontSize:14, color:APG2_PROFILE.textSoft, lineHeight:'21px' }}>
              Ключи, партнеры, события и награды Зеленограда
            </div>
          </div>
        </div>

        {/* Преимущества */}
        <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:9 }}>
          {PERKS.map((p, i) => (
            <GlassCard key={p.label} style={{ display:'flex', alignItems:'center', gap:13, borderRadius:24, padding:'12px 14px', animation:'fadeInUp 0.45s ease both', animationDelay:`${0.1 + i * 0.07}s` }}>
              <div style={{ width:40, height:40, borderRadius:16, background:p.color+'22', border:`1px solid ${p.color}38`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, flexShrink:0 }}>
                {p.icon}
              </div>
              <span style={{ fontSize:14, color:APG2_PROFILE.text, fontWeight:760 }}>{p.label}</span>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Нижняя часть */}
      <div style={{ padding:'16px 24px calc(26px + env(safe-area-inset-bottom, 0px))', position:'relative', zIndex:1, animation:'fadeInUp 0.5s ease 0.35s both' }}>
        {isWebMode ? (
          !showNameInput ? (
            <>
              {/* Основная кнопка — открыть в ВК */}
              <GlassButton
                onClick={openVKApp}
                style={{ width:'100%', minHeight:58, borderRadius:24, fontSize:16, fontWeight:850, gap:10, marginBottom:10 }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.019-1.304.583-1.496c.595-.19 1.361 1.26 2.174 1.815.614.418 1.08.326 1.08.326l2.17-.03s1.134-.071.597-.964c-.044-.073-.314-.665-1.621-1.879-1.368-1.271-1.184-1.066.463-3.267.998-1.334 1.397-2.148 1.272-2.495-.12-.331-.852-.243-.852-.243l-2.442.015s-.181-.025-.315.056c-.132.08-.217.267-.217.267s-.387 1.041-.903 1.927c-1.088 1.86-1.524 1.96-1.702 1.844-.414-.269-.311-1.077-.311-1.652 0-1.797.271-2.546-.528-2.739-.265-.065-.46-.107-1.137-.114-.869-.009-1.603.003-2.019.207-.276.136-.49.439-.36.456.161.022.525.099.719.364.249.344.24 1.115.24 1.115s.143 2.115-.333 2.378c-.327.178-.776-.185-1.739-1.846-.494-.857-.868-1.805-.868-1.805s-.072-.18-.202-.277c-.157-.116-.376-.153-.376-.153l-2.322.015s-.348.01-.476.163c-.114.136-.009.417-.009.417s1.818 4.27 3.877 6.421c1.888 1.974 4.031 1.843 4.031 1.843h.97z"/>
                </svg>
                Открыть в ВКонтакте
              </GlassButton>

              {/* Разделитель */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }} />
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.25)' }}>или</span>
                <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }} />
              </div>

              {/* Демо-версия */}
              <GlassButton
                onClick={() => setShowNameInput(true)}
                style={{ width:'100%', minHeight:54, color:APG2_PROFILE.textSoft, fontSize:14, fontWeight:760 }}
              >
                Посмотреть демо-версию
              </GlassButton>

              <div style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.18)', marginTop:12, lineHeight:'16px' }}>
                Полный функционал доступен в приложении ВКонтакте
              </div>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setShowNameInput(false)} style={{ background:'none', border:'none', color:T.textSec, fontSize:13, cursor:'pointer', padding:'0 0 14px', display:'flex', alignItems:'center', gap:4 }}>
                ← Назад
              </button>
              <div style={{ fontSize:13, color:T.textSec, textAlign:'center', marginBottom:14, lineHeight:'18px' }}>
                Введите имя для демо-доступа
              </div>
              <GlassInput
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleWebSubmit()}
                placeholder="Ваше имя"
                autoFocus
                style={{ minHeight: 56, borderRadius: 22, marginBottom: 12, border: `1px solid ${name.trim() ? 'rgba(215,184,106,0.52)' : 'var(--apg2-glass-border, rgba(255,255,255,0.16))'}` }}
              />
              <GlassButton
                onClick={handleWebSubmit}
                disabled={!name.trim()}
                tone="gold"
                style={{ width:'100%', minHeight:58, borderRadius:24, fontSize:16, fontWeight:880 }}
              >
                Войти в демо
              </GlassButton>
              <div style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.18)', marginTop:12, lineHeight:'16px' }}>
                Демо-данные не синхронизируются с ВКонтакте
              </div>
            </>
          )
        ) : (
          <>
            <GlassButton
              onClick={onLogin}
              tone="gold"
              style={{ width:'100%', minHeight:58, borderRadius:24, fontSize:16, fontWeight:880 }}
            >
              Войти через ВКонтакте
            </GlassButton>
            <div style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.18)', marginTop:12, lineHeight:'16px' }}>
              Используется ваш аккаунт ВКонтакте · Никакого пароля
            </div>
          </>
        )}
      </div>
    </div>
  );
}
