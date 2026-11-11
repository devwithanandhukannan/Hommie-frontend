'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useServerStatus } from '@/lib/serverStatus';
import Shell from '@/components/Shell';
import { ShellSkeleton, SystemBootScreen, Btn } from '@/components/ui';

export default function AppLayout({ children }) {
  const { status, family, families, retryBoot, t } = useAuth();
  const { isBooting, isWakingUp } = useServerStatus();
  const router = useRouter();
  useEffect(() => {
    if (status === 'anon') router.replace('/login');
    else if (status === 'authed' && sessionStorage.getItem('fh_join_code')) router.replace('/join');
    else if (status === 'authed' && !families.length) router.replace('/onboarding');
  }, [status, families, router]);
  if (status === 'offline') {
    return (
      <div className="offline-screen">
        <img src="/icon-192.png" alt="" width="72" height="72" />
        <h1>{t('common.offline')}</h1>
        <p className="muted">Hommi could not reach the server. Your session is safe.</p>
        <Btn onClick={retryBoot}>{t('common.retry')}</Btn>
      </div>
    );
  }
  if (status === 'loading' && (isBooting || isWakingUp)) {
    return <SystemBootScreen title={t('common.booting_title')} sub={t('common.booting_sub')} />;
  }
  if (status !== 'authed' || !family) return <ShellSkeleton />;
  return <Shell>{children}</Shell>;
}
