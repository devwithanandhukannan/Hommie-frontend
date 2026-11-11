'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useServerStatus } from '@/lib/serverStatus';
import { Spinner, SystemBootScreen } from '@/components/ui';

// Deep link used by push notifications: switch to the right family, then open the target page.
function Open() {
  const { status, families, switchFamily, t } = useAuth();
  const { isBooting, isWakingUp } = useServerStatus();
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    if (status === 'anon') { router.replace('/login'); return; }
    if (status !== 'authed') return;
    const fam = params.get('family');
    const to = params.get('to') || '/dashboard';
    const safe = to.startsWith('/') && !to.startsWith('//') ? to : '/dashboard';
    (async () => {
      if (fam && families.some((f) => f.id === fam)) await switchFamily(fam);
      router.replace(safe);
    })();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  if (status === 'loading' && (isBooting || isWakingUp)) {
    return <SystemBootScreen title={t('common.booting_title')} sub={t('common.booting_sub')} />;
  }
  return <Spinner />;
}
export default function Page() { return <Suspense fallback={<Spinner />}><Open /></Suspense>; }
