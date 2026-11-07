'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { post } from '@/lib/api';
import { AuthCard } from '@/components/AuthCard';
import { Field, Input, Select, Btn, ErrorNote, Tabs, Spinner } from '@/components/ui';

function Onboarding() {
  const { status, user, loadOverview, switchFamily, signOut, families } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'join' ? 'join' : 'create');
  const [f, setF] = useState({ name: '', type: 'home' });
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (status === 'anon') router.replace('/login'); }, [status, router]);
  if (status !== 'authed') return <Spinner />;

  const finish = async (fam) => { await loadOverview(); await switchFamily(fam.id); router.replace('/dashboard'); };
  const create = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await finish(await post('/families', f, { family: false })); } catch (err) { setError(err); setBusy(false); }
  };
  const join = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await finish(await post('/families/accept-invite', { code }, { family: false })); } catch (err) { setError(err); setBusy(false); }
  };
  return (
    <AuthCard title={`Hi ${user?.name?.split(' ')[0] || ''}`} sub="Create a family space, or join one with an invite code from a family member.">
      <div className="col">
        <Tabs value={mode} onChange={setMode} items={[['create', 'Create family'], ['join', 'Join with code']]} />
        {mode === 'create' ? (
          <form className="col" onSubmit={create}>
            <Field label="Family name">{(id) => <Input id={id} required maxLength={60} placeholder="Our Home" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
            <Field label="Type" hint="A rented flat shared with a partner or friends is its own family.">{(id) => (
              <Select id={id} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="home">Home</option><option value="rent">Rented flat</option><option value="other">Other</option></Select>
            )}</Field>
            <ErrorNote error={error} /><Btn type="submit" disabled={busy}>Create family</Btn>
          </form>
        ) : (
          <form className="col" onSubmit={join}>
            <Field label="Invite code">{(id) => <Input id={id} required placeholder="ABCD-EFGH-JKMN-PQRS" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" />}</Field>
            <ErrorNote error={error} /><Btn type="submit" disabled={busy}>Join family</Btn>
          </form>
        )}
        <div className="row between small">
          {families.length ? <Btn tone="ghost" size="sm" onClick={() => router.replace('/dashboard')}>Back</Btn> : <span />}
          <Btn tone="ghost" size="sm" onClick={signOut}>Sign out</Btn>
        </div>
      </div>
    </AuthCard>
  );
}
export default function Page() { return <Suspense fallback={<Spinner />}><Onboarding /></Suspense>; }
