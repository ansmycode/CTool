import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Vite removes this diagnostic block from production builds.
if (import.meta.env.DEV) {
  performance.mark('ctool:renderer-entry');
  console.info(`[startup] Renderer modules ready at ${Math.round(performance.now())}ms after navigation`);
  document.addEventListener('visibilitychange', () => {
    console.info(`[startup] Page visibility ${document.visibilityState} at ${Math.round(performance.now())}ms after navigation`);
  });
  if (PerformanceObserver.supportedEntryTypes.includes('paint')) {
    const observer = new PerformanceObserver(list => {
      const paint = list.getEntries().find(entry => entry.name === 'first-contentful-paint');
      if (paint) {
        console.info(`[startup] First contentful paint at ${Math.round(paint.startTime)}ms after navigation`);
        observer.disconnect();
      }
    });
    observer.observe({ type: 'paint', buffered: true });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
