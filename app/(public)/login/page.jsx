'use client';
import Link from 'next/link';
import { afterAuthPath } from '@/lib/joinFlow';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { prefetchCsrf } from '@/lib/api';
import { AuthCard } from '@/components/AuthCard';
import { Field, Input, Btn, ErrorNote } from '@/components/ui';

export default function Login() {
  const { signIn, status, families, t } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    prefetchCsrf();
  }, []);

  useEffect(() => { if (status === 'authed') router.replace(afterAuthPath(families)); }, [status, families, router]);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { const list = await signIn('/auth/login', { email, password }); router.replace(afterAuthPath(list)); } catch (err) { setError(err); setBusy(false); }
  };
  return (
    <AuthCard title={t('auth.welcome_back')} sub={t('auth.signin_sub')}>
      <form className="col" onSubmit={submit}>
        <Field label={t('auth.email')}>{(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label={t('auth.password')}>{(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        <ErrorNote error={error} />
        <Btn type="submit" disabled={busy}>{busy ? t('auth.signing') : t('auth.signin')}</Btn>
        <div className="small" style={{ textAlign: 'center' }}><Link href="/register">{t('auth.create_account')}</Link> · <Link href="/reset">{t('auth.forgot')}</Link></div>
      </form>
    </AuthCard>
  );
}
