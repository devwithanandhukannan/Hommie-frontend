'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { post, prefetchCsrf } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthCard } from '@/components/AuthCard';
import { Field, Input, Btn, ErrorNote, useToast } from '@/components/ui';

export default function Register() {
  const { signIn } = useAuth();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    prefetchCsrf();
  }, []);

  const [step, setStep] = useState('details'); // 'details' | 'otp'
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Step 1: Send OTP to user email
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/auth/register/send-otp', f, { auth: false, family: false });
      setStep('otp');
      toast('Verification code sent to your email');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  // Step 2: Verify OTP and log in
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const list = await signIn('/auth/register/verify-otp', { email: f.email, otp });
      router.replace(list && list.length ? '/dashboard' : '/onboarding');
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  // Resend code
  const handleResend = async () => {
    setResending(true);
    setError(null);
    try {
      await post('/auth/register/send-otp', f, { auth: false, family: false });
      toast('New verification code sent');
    } catch (err) {
      setError(err);
    } finally {
      setResending(false);
    }
  };

  if (step === 'otp') {
    return (
      <AuthCard
        title="Check your email"
        sub={`We sent a 6-digit verification code to ${f.email}`}
      >
        <form className="col" onSubmit={handleVerifyOtp} style={{ gap: 16 }}>
          <Field label="6-Digit Verification Code">
            {(id) => (
              <Input
                id={id}
                required
                autoFocus
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="123456"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{
                  fontSize: 24,
                  letterSpacing: 8,
                  textAlign: 'center',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              />
            )}
          </Field>

          <ErrorNote error={error} />

          <Btn type="submit" disabled={busy || otp.length < 6}>
            {busy ? 'Verifying…' : 'Verify & Continue'}
          </Btn>

          <div className="row between" style={{ fontSize: 13, marginTop: 4 }}>
            <button
              type="button"
              className="btn ghost sm"
              style={{ color: 'var(--brand)', padding: '4px 8px' }}
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>

            <button
              type="button"
              className="btn ghost sm"
              style={{ color: 'var(--muted)', padding: '4px 8px' }}
              onClick={() => { setStep('details'); setOtp(''); setError(null); }}
            >
              Change email
            </button>
          </div>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" sub="Then create a family or join one with a code">
      <form className="col" onSubmit={handleSendOtp} style={{ gap: 14 }}>
        <Field label="Your name">
          {(id) => (
            <Input
              id={id}
              required
              maxLength={80}
              autoComplete="name"
              placeholder="e.g. Anandhu"
              value={f.name}
              onChange={set('name')}
            />
          )}
        </Field>

        <Field label="Email">
          {(id) => (
            <Input
              id={id}
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={f.email}
              onChange={set('email')}
            />
          )}
        </Field>

        <Field label="Password" hint="At least 10 characters">
          {(id) => (
            <Input
              id={id}
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
              value={f.password}
              onChange={set('password')}
            />
          )}
        </Field>

        <ErrorNote error={error} />

        <Btn type="submit" disabled={busy}>
          {busy ? 'Sending verification code…' : 'Continue'}
        </Btn>

        <div className="small" style={{ textAlign: 'center', marginTop: 4 }}>
          Already have an account? <Link href="/login" style={{ fontWeight: 600 }}>Sign in</Link>
        </div>
      </form>
    </AuthCard>
  );
}
