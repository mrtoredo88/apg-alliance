import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { UserApp } from './UserApp'; // Перенесите ваш текущий код App в этот файл
import { AdminPanel } from './AdminPanel';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<UserApp />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </HashRouter>
  );
}