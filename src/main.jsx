import { createRoot } from 'react-dom/client';
import vkBridge from '@vkontakte/vk-bridge';
import { App } from './App.jsx'; // Теперь импортируем главный компонент App

vkBridge.send('VKWebAppInit');

createRoot(document.getElementById('root')).render(<App />);

if (import.meta.env.MODE === 'development') {
  import('./eruda.js');
}