'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { prefetchCsrf } from '@/lib/api';
import { AuthCard } from '@/components/AuthCard';
import { Field, Input, Btn, ErrorNote } from '@/components/ui';

export default function Login() {
  const { signIn, status, families } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    prefetchCsrf();
  }, []);

  useEffect(() => { if (status === 'authed') router.replace(families.length ? '/dashboard' : '/onboarding'); }, [status, families, router]);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { const list = await signIn('/auth/login', { email, password }); router.replace(list.length ? '/dashboard' : '/onboarding'); } catch (err) { setError(err); setBusy(false); }
  };
  return (
    <AuthCard title="Welcome back" sub="Sign in to your family space">
      <form className="col" onSubmit={submit}>
        <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Password">{(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        <ErrorNote error={error} />
        <Btn type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Btn>
        <div className="small" style={{ textAlign: 'center' }}><Link href="/register">Create an account</Link> · <Link href="/reset">Forgot password?</Link></div>
      </form>
    </AuthCard>
  );
}
