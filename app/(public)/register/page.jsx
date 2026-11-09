'use client';
import Link from 'next/link';
import { afterAuthPath } from '@/lib/joinFlow';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { post, prefetchCsrf } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthCard } from '@/components/AuthCard';
import { Field, Input, Btn, ErrorNote, useToast } from '@/components/ui';

export default function Register() {
  const { signIn, t } = useAuth();
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
      router.replace(afterAuthPath(list));
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
        title={t('auth.check_email')}
        sub={`${t('auth.sent_to')} ${f.email}`}
      >
        <form className="col" onSubmit={handleVerifyOtp} style={{ gap: 16 }}>
          <Field label={t('auth.code_label')}>
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
            {busy ? t('auth.verifying') : t('auth.verify')}
          </Btn>

          <div className="row between" style={{ fontSize: 13, marginTop: 4 }}>
            <button
              type="button"
              className="btn ghost sm"
              style={{ color: 'var(--brand)', padding: '4px 8px' }}
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? t('auth.sending') : t('auth.resend')}
            </button>

            <button
              type="button"
              className="btn ghost sm"
              style={{ color: 'var(--muted)', padding: '4px 8px' }}
              onClick={() => { setStep('details'); setOtp(''); setError(null); }}
            >
              {t('auth.change_email')}
            </button>
          </div>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.create_title')} sub={t('auth.create_sub')}>
      <form className="col" onSubmit={handleSendOtp} style={{ gap: 14 }}>
        <Field label={t('auth.name')}>
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

        <Field label={t('auth.email')}>
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

        <Field label={t('auth.password')} hint={t('auth.pw_hint')}>
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
          {busy ? t('auth.sending_code') : t('auth.continue')}
        </Btn>

        <div className="small" style={{ textAlign: 'center', marginTop: 4 }}>
          {t('auth.have_account')} <Link href="/login" style={{ fontWeight: 600 }}>{t('auth.signin')}</Link>
        </div>
      </form>
    </AuthCard>
  );
}
