'use client';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider, ConfirmProvider } from '@/components/ui';

export function Providers({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>{children}</AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
