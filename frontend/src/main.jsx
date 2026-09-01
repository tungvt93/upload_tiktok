import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './api.js'; // Configure axios baseURL for Electron compatibility
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

