import { createRoot } from 'react-dom/client';
import vkBridge from '@vkontakte/vk-bridge';
import { App } from './App.jsx'; // Рендерим именно Роутер!

vkBridge.send('VKWebAppInit');

createRoot(document.getElementById('root')).render(<App />);

if (import.meta.env.MODE === 'development') {
  import('./eruda.js');
}