import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  // When a new service worker takes over, reload once to fetch fresh content
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED' && !sessionStorage.getItem('sw_reloaded')) {
      sessionStorage.setItem('sw_reloaded', '1');
      window.location.reload();
    }
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/family-expense/sw.js');
  });
  // The browser only checks for a new service worker on its own schedule
  // (often ~24h) or on a fresh navigation — neither fires when a PWA is just
  // resumed from the background, which is the common case on iOS. Explicitly
  // re-check the moment the app becomes visible again, so a deploy made
  // while someone's app was backgrounded gets picked up as soon as they
  // return to it, not on some indefinite later check.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then(reg => reg?.update());
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)