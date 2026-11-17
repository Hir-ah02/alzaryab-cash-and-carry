import './index.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { CartProvider } from '@/cart/CartProvider';
import { ToastProvider } from '@/components/Toast';
import { createQueryClient } from '@/lib/queryClient';

const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
