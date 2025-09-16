// ⚠️ CRITICAL WARNING: NEVER ADD DEMO MODE TO THIS APPLICATION
// The client has explicitly forbidden ANY form of demo, mock, or test mode.
// This application REQUIRES a live database connection to function.
// DO NOT add any demo mode, mock data, or bypass mechanisms.

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

