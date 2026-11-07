'use client';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider, ConfirmProvider } from '@/components/ui';
import { ServerStatusProvider } from '@/lib/serverStatus';

export function Providers({ children }) {
  return (
    <ServerStatusProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>{children}</AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ServerStatusProvider>
  );
}
