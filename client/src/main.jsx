import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HeroUIProvider } from '@heroui/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { ComposeProvider } from './context/ComposeContext';

// Tailwind/HeroUI first so our hand-rolled CSS wins any class-name collisions
import './styles/tailwind.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <HeroUIProvider>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <ComposeProvider>
                <App />
              </ComposeProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </HeroUIProvider>
    </BrowserRouter>
  </React.StrictMode>
);
