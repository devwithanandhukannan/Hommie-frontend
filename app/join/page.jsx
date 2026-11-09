'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthCard } from '@/components/AuthCard';
import { Btn, ErrorNote, Spinner } from '@/components/ui';
import { clearJoinCode, pendingJoinCode, rememberJoinCode } from '@/lib/joinFlow';

function JoinContent() {
  const { status, t, loadOverview, switchFamily } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromLink = params.get('code');
    if (fromLink) { rememberJoinCode(fromLink); setCode(fromLink); }
    else setCode(pendingJoinCode());
  }, [params]);

  const join = async () => {
    setBusy(true); setError(null);
    try {
      const fam = await post('/families/accept-invite', { code }, { family: false });
      clearJoinCode();
      await loadOverview();
      await switchFamily(fam.id);
      router.replace('/dashboard');
    } catch (e) { setError(e); setBusy(false); }
  };

  if (status === 'loading') return <Spinner />;
  if (!code) {
    return <AuthCard title={t('join.title')} sub=""><Link href="/dashboard" className="btn">{t('nav.today')}</Link></AuthCard>;
  }
  return (
    <AuthCard title={t('join.title')} sub={t('join.sub')}>
      <div className="col">
        <ErrorNote error={error} />
        {status === 'authed' ? (
          <Btn onClick={join} disabled={busy}>{t('join.btn')}</Btn>
        ) : (
          <>
            <Link href="/register" className="btn">{t('join.create')}</Link>
            <Link href="/login" className="btn ghost">{t('join.signin')}</Link>
          </>
        )}
      </div>
    </AuthCard>
  );
}

export default function JoinPage() {
  return <Suspense fallback={<Spinner />}><JoinContent /></Suspense>;
}
