'use client';
import { AuthProvider } from '@/lib/auth';
import { ServerStatusProvider } from '@/lib/serverStatus';
import { ToastProvider, ConfirmProvider } from '@/components/ui';

export function Providers({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ServerStatusProvider>
          <AuthProvider>{children}</AuthProvider>
        </ServerStatusProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
