import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserApp } from './UserApp.jsx';
import { AdminPanel } from './AdminPanel.jsx';

export function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Главная */}
        <Route path="/" element={<UserApp />} />
        
        {/* Админка */}
        <Route path="/admin" element={<AdminPanel />} />
        
        {/* Если кто-то ввел несуществующий путь, кидаем на главную */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}