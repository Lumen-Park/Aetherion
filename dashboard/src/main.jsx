import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './APP';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Aetherion dashboard root element was not found.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
