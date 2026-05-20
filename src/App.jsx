import React, { useState, useEffect } from 'react';
import { Scanner } from './Scanner.jsx';

export function App() {
  // База данных ключей
  const [userKeys, setUserKeys] = useState(() => {
    const savedKeys = localStorage.getItem('apg_user_keys');
    return savedKeys ? parseInt(savedKeys, 10) : 3;
  });
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState('main');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPlace, setSelectedPlace] = useState(1);

  useEffect(() => {
    localStorage.setItem('apg_user_keys', userKeys);
  }, [userKeys]);

  const [user] = useState({ name: "Константин", totalPartners: 18 });

  const getUserLevel = () => {
    if (userKeys >= 7) return { title: "Амбассадор Альянса 👑", color: "#ffaa00" };
    if (userKeys >= 5) return { title: "Местный житель 🌆", color: "#7f00ff" };
    return { title: "Гость города 🪐", color: "#00f0ff" };
  };

  const currentLevel = getUserLevel();

  const categories = [
    { id: 'all', name: 'Все', icon: '⚡' },
    { id: 'coffee', name: 'Кофе', icon: '☕' },
    { id: 'food', name: 'Еда', icon: '🍔' },
    { id: 'beauty', name: 'Красота', icon: '💅' },
    { id: 'bars', name: 'Бары', icon: '🍹' },
  ];

  const promotions = [
    { id: 1, category: 'coffee', partner: 'Кофемания', title: 'Секретный пряный раф', text: 'Покажи 1 ключ и получи авторский десерт в подарок при заказе кофе.', color: '#ff007f' },
    { id: 2, category: 'beauty', partner: 'Красота & Вайб', title: 'Вечерний Слот на массаж', text: 'Свободное время на 19:00 со скидкой 20% для своих жителей АПГ.', color: '#7f00ff' },
    { id: 3, category: 'food', partner: 'Бургер Лаб', title: 'Крафтовый комбо-обед', text: 'Скидка 15% на любое меню при наличии статуса "Гость города".', color: '#00f0ff' },
    { id: 4, category: 'bars', partner: 'Неон Бар', title: 'Фирменный коктейль "АПГ"', text: 'Два напитка по цене одного каждый четверг для держателей ключей.', color: '#ffaa00' }
  ];

  const mapPlaces = [
    { id: 1, name: 'Кофемания', type: 'Кофейня', icon: '☕', color: '#ff007f', x: '25%', y: '30%' },
    { id: 2, name: 'Красота & Вайб', type: 'Салон массажа', icon: '💅', color: '#7f00ff', x: '70%', y: '20%' },
    { id: 3, name: 'Бургер Лаб', type: 'Крафт-бургерная', icon: '🍔', color: '#00f0ff', x: '40%', y: '65%' },
    { id: 4, name: 'Неон Бар', type: 'Секретный бар', icon: '🍹', color: '#ffaa00', x: '75%', y: '70%' },
  ];

  const currentPlaceInfo = mapPlaces.find(p => p.id === selectedPlace);
  const filteredPromotions = selectedCategory === 'all' ? promotions : promotions.filter(item => item.category === selectedCategory);
  
  const handleConfirmScan = (partnerName) => {
    setUserKeys(prev => prev + 1);
    setIsScannerOpen(false);
    alert(`🎉 Успешно! Ты отсканировал чекин в "${partnerName}". +1 Ключ добавлен в базу данных! 🔑`);
  };

  const handleResetDatabase = () => {
    setUserKeys(3);
    alert("🔄 База данных очищена, баланс сброшен до 3 ключей.");
  };

  return (
    <div style={{ 
      background: '#0d0d13', color: '#ffffff', minHeight: '100vh', 
      padding: '20px 20px 90px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      boxSizing: 'border-box', position: 'relative'
    }}>
      
      {activeScreen === 'main' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', letterSpacing: '0.5px' }}>🌆 АПГ | Альянс</h2>
            <span style={{ fontSize: '13px', color: '#666', cursor: 'pointer' }} onClick={handleResetDatabase}>🔄 Сброс БД</span>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #1b1b2f 0%, #161625 100%)', borderRadius: '16px', padding: '16px', marginBottom: '24px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #ff007f, #7f00ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👤</div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>Привет, Константин!</div>
                <div style={{ fontSize: '12px', color: currentLevel.color, marginTop: '2px', textTransform: 'uppercase', fontWeight: '600' }}>
                  {currentLevel.title}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#aaa' }}>Мои Ключи</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#00f0ff', marginTop: '4px' }}>🔑 {userKeys}</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(255, 0, 127, 0.05)', border: '1px solid rgba(255, 0, 127, 0.2)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#aaa' }}>Партнёры</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#ff007f', marginTop: '4px' }}>🏢 18</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '5px' }}>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '20px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', background: selectedCategory === cat.id ? 'linear-gradient(90deg, #ff007f, #7f00ff)' : '#161625', color: '#ffffff' }}>
                <span>{cat.icon}</span> {cat.name}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '16px', fontWeight: 'bold', fontSize: '15px', color: '#aaa', textTransform: 'uppercase' }}>🔥 Сегодня в городе</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredPromotions.map(promo => (
              <div key={promo.id} style={{ background: '#161625', borderRadius: '14px', padding: '16px', borderLeft: `4px solid ${promo.color}` }}>
                <div style={{ fontSize: '11px', color: promo.color, fontWeight: '600', textTransform: 'uppercase' }}>{promo.partner}</div>
                <h4 style={{ margin: '6px 0', fontSize: '15px', fontWeight: '600' }}>{promo.title}</h4>
                <p style={{ margin: 0, color: '#aaa', fontSize: '13px', lineHeight: '1.4' }}>{promo.text}</p>
              </div>
            ))}
          </div>

          <button onClick={() => setIsScannerOpen(true)} style={{ width: '100%', background: 'linear-gradient(90deg, #ff007f, #7f00ff)', border: 'none', color: 'white', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: '600', marginTop: '24px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(255, 0, 127, 0.3)' }}>
            ✨ Сканировать QR-код партнера
          </button>
        </div>
      )}

      {activeScreen === 'map' && (
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', letterSpacing: '0.5px' }}>📍 Радар Альянса</h2>
          <p style={{ color: '#aaa', fontSize: '13px', margin: '0 0 20px 0' }}>Нажимай на неоновые точки заведений, чтобы найти их в городе.</p>
          
          <div style={{ width: '100%', height: '320px', background: '#09090d', borderRadius: '20px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(127, 0, 255, 0.2)' }}>
            {mapPlaces.map(place => (
              <div key={place.id} onClick={() => setSelectedPlace(place.id)} style={{ position: 'absolute', left: place.x, top: place.y, transform: 'translate(-50%, -50%)', cursor: 'pointer', zIndex: 10 }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#161625', border: `2px solid ${place.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: selectedPlace === place.id ? `0 0 20px ${place.color}` : `0 0 5px ${place.color}` }}>
                  {place.icon}
                </div>
              </div>
            ))}
          </div>

          {currentPlaceInfo && (
            <div style={{ marginTop: '16px', background: 'linear-gradient(135deg, #1b1b2f 0%, #161625 100%)', borderRadius: '16px', padding: '16px', border: `1px solid ${currentPlaceInfo.color}33` }}>
              <h3 style={{ margin: '4px 0 2px 0', fontSize: '17px' }}>{currentPlaceInfo.name}</h3>
              <button onClick={() => alert(`Маршрут к "${currentPlaceInfo.name}" построен!`)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginTop: '8px', cursor: 'pointer' }}>
                🗺️ Построить маршрут
              </button>
            </div>
          )}
        </div>
      )}

      {activeScreen === 'profile' && (
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', letterSpacing: '0.5px' }}>👤 Паспорт Жителя АПГ</h2>
          <div style={{ background: 'linear-gradient(135deg, #1b1b2f 0%, #161625 100%)', borderRadius: '20px', padding: '24px 16px', textAlign: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Константин</h3>
            <div style={{ display: 'inline-block', padding: '6px 14px', borderRadius: '20px', background: `${currentLevel.color}15`, border: `1px solid ${currentLevel.color}44`, color: currentLevel.color, fontSize: '13px', fontWeight: '700' }}>
              {currentLevel.title}
            </div>
          </div>
        </div>
      )}

      <Scanner 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        mapPlaces={mapPlaces} 
        onConfirm={handleConfirmScan} 
      />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '64px',
        background: '#11111b', borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 100
      }}>
        <button onClick={() => setActiveScreen('main')} style={{ background: 'none', border: 'none', color: activeScreen === 'main' ? '#ff007f' : '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '18px' }}>🌆</span> Лента
        </button>
        <button onClick={() => setActiveScreen('map')} style={{ background: 'none', border: 'none', color: activeScreen === 'map' ? '#7f00ff' : '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '18px' }}>📍</span> Карта
        </button>
        <button onClick={() => setActiveScreen('profile')} style={{ background: 'none', border: 'none', color: activeScreen === 'profile' ? '#00f0ff' : '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '18px' }}>👤</span> Профиль
        </button>
      </div>
    </div>
  );
}