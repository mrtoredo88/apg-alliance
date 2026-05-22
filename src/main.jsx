import { createRoot } from 'react-dom/client';
import vkBridge from '@vkontakte/vk-bridge';
import { App } from './App.jsx'; // Рендерим именно Роутер!
import './index.css'; // Добавьте это в начало файла

vkBridge.send('VKWebAppInit');

createRoot(document.getElementById('root')).render(<App />);

if (import.meta.env.MODE === 'development') {
  import('./eruda.js');
}