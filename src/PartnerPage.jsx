import React, { useState } from 'react';
import { Panel, PanelHeader, PanelHeaderBack } from '@vkontakte/vkui';

const T = {
  bg:'#0F0F1A',surface:'#1A1A2E',border:'rgba(255,255,255,0.07)',
  gold:'#C9A84C',goldL:'#E8C97A',blue:'#4A90D9',green:'#4BB34B',red:'#E64646',
  textPri:'#F0F0F0',textSec:'rgba(240,240,240,0.5)',
};

function PartnerLogo({ partner }) {
  const [failed, setFailed] = useState(false);
  const name = partner.name ?? '?';
  const initial = name[0].toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const size = 88;

  if (!partner.logoUrl || failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, hsl(${hue},45%,22%), hsl(${hue},35%,34%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 800, color: 'rgba(255,255,255,0.92)', border: '3px solid rgba(255,255,255,0.15)' }}>
        {initial}
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', padding: 3, background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})` }}>
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
        <img src={partner.logoUrl} alt="" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
}

export function PartnerPage({ partner, isFavorite, onBack, onToggleFavorite }) {
  if (!partner) return null;
  const handlePhone = () => partner.phone && window.open(`tel:${partner.phone.replace(/\s/g,'')}`, '_self');
  const handleMap = () => partner.address && window.open(`https://yandex.ru/maps/?text=${encodeURIComponent(partner.address)}`, '_blank');
  const handleSocial = () => partner.socialUrl && window.open(partner.socialUrl, '_blank');

  const infoRows = [
    partner.hours   && { icon:'🕐', label:'Часы работы', value:partner.hours },
    partner.address && { icon:'📍', label:'Адрес',       value:partner.address, onClick:handleMap },
    partner.phone   && { icon:'📞', label:'Телефон',     value:partner.phone,   onClick:handlePhone },
  ].filter(Boolean);

  return (
    <Panel id="partner">
      <PanelHeader before={<PanelHeaderBack onClick={onBack} />}>{partner.name}</PanelHeader>
      <div style={{background:T.bg,minHeight:'100%'}}>

        {/* Шапка */}
        <div style={{margin:'8px 16px',borderRadius:24,background:'linear-gradient(135deg,#0F0F2E,#1A1A4E)',padding:'28px 20px 24px',position:'relative',overflow:'hidden',border:`1px solid rgba(201,168,76,0.2)`}}>
          <div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(rgba(201,168,76,0.05) 1px,transparent 1px)',backgroundSize:'20px 20px'}}/>
          <div style={{position:'absolute',top:-40,right:-40,width:160,height:160,borderRadius:'50%',background:'radial-gradient(circle,rgba(201,168,76,0.1),transparent 70%)'}}/>
          <div style={{position:'relative',display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
            <PartnerLogo partner={partner} />
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:800,color:T.textPri,marginBottom:4}}>{partner.name}</div>
              {partner.categoryLabel&&<div style={{display:'inline-flex',alignItems:'center',gap:6,background:T.gold+'18',border:`1px solid ${T.gold}40`,borderRadius:20,padding:'4px 12px'}}><span style={{fontSize:11,color:T.gold,fontWeight:700}}>✦ {partner.categoryLabel}</span></div>}
            </div>
            {partner.description&&<div style={{fontSize:14,color:T.textSec,textAlign:'center',lineHeight:'20px',maxWidth:280}}>{partner.description}</div>}
          </div>
        </div>

        {/* Спецпредложение */}
        {partner.offer&&(
          <div style={{margin:'12px 16px',borderRadius:20,background:`linear-gradient(135deg,${T.gold}20,${T.goldL}10)`,border:`1px solid ${T.gold}40`,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
            <div style={{fontSize:28,flexShrink:0}}>🎁</div>
            <div>
              <div style={{fontSize:11,color:T.gold,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:4}}>Предложение для участников АПГ</div>
              <div style={{fontSize:14,color:T.textPri,fontWeight:600}}>{partner.offer}</div>
            </div>
          </div>
        )}

        {/* Информация */}
        {infoRows.length>0&&(
          <div style={{margin:'12px 16px'}}>
            <div style={{fontSize:13,color:T.gold,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:10}}>✦ Информация</div>
            <div style={{background:T.surface,borderRadius:20,overflow:'hidden',border:`1px solid ${T.border}`}}>
              {infoRows.map((row,i)=>(
                <div key={row.label} onClick={row.onClick} style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:12,borderBottom:i<infoRows.length-1?`1px solid ${T.border}`:'none',cursor:row.onClick?'pointer':'default'}}>
                  <div style={{width:36,height:36,borderRadius:10,background:'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{row.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,color:T.textSec,marginBottom:2}}>{row.label}</div>
                    <div style={{fontSize:14,color:row.onClick?T.blue:T.textPri,fontWeight:500}}>{row.value}</div>
                  </div>
                  {row.onClick&&<span style={{color:T.textSec,fontSize:16}}>›</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Кнопки */}
        <div style={{margin:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
          {partner.phone&&<button onClick={handlePhone} style={{width:'100%',padding:'15px 0',borderRadius:16,border:'none',background:`linear-gradient(135deg,${T.green},#3a9a3a)`,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer'}}>📞 Позвонить</button>}
          {partner.address&&<button onClick={handleMap} style={{width:'100%',padding:'15px 0',borderRadius:16,border:'none',background:'linear-gradient(135deg,#FF6600,#FF8C00)',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer'}}>🗺️ Проложить маршрут</button>}
          {partner.socialUrl&&<button onClick={handleSocial} style={{width:'100%',padding:'15px 0',borderRadius:16,border:'none',background:`linear-gradient(135deg,${T.blue},#2D6FBC)`,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer'}}>📱 Перейти в соцсеть</button>}
          <button onClick={()=>onToggleFavorite(partner.id)} style={{width:'100%',padding:'15px 0',borderRadius:16,border:isFavorite?`1px solid ${T.red}44`:'none',background:isFavorite?T.red+'15':`linear-gradient(135deg,${T.gold},${T.goldL})`,color:isFavorite?T.red:'#0F0F1A',fontSize:15,fontWeight:700,cursor:'pointer'}}>
            {isFavorite?'♥ Убрать из избранного':'♡ Добавить в избранное'}
          </button>
        </div>
        <div style={{height:24}}/>
      </div>
    </Panel>
  );
}
