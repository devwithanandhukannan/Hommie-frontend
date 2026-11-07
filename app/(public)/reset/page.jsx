'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { post } from '@/lib/api';
import { AuthCard } from '@/components/AuthCard';
import { Field, Input, Btn, ErrorNote, useToast } from '@/components/ui';

export default function Reset() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const urlToken = searchParams?.get('token') || '';
  const urlEmail = searchParams?.get('email') || '';

  const [mode, setMode] = useState(urlToken ? 'new_password' : 'request_link'); // 'request_link' | 'new_password' | 'admin_code'
  const [email, setEmail] = useState(urlEmail);
  const [token, setToken] = useState(urlToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  useEffect(() => {
    if (urlToken) {
      setMode('new_password');
      setToken(urlToken);
    }
    if (urlEmail) {
      setEmail(urlEmail);
    }
  }, [urlToken, urlEmail]);

  // Request Reset Link via Email
  const handleRequestLink = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/auth/forgot-password', { email: email.trim() }, { auth: false, family: false });
      setSentSuccess(true);
      toast('Reset link sent to your email');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  // Submit New Password with Token from Email Link
  const handleResetWithToken = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(new Error('Passwords do not match'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await post(
        '/auth/reset-password',
        { email: email.trim(), token, newPassword },
        { auth: false, family: false }
      );
      toast('Password updated successfully! Please sign in.');
      router.replace('/login');
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  // Submit Admin One-Time Code
  const handleResetWithAdminCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post(
        '/auth/reset',
        { email: email.trim(), code: adminCode.trim(), newPassword },
        { auth: false, family: false }
      );
      toast('Password changed! Please sign in.');
      router.replace('/login');
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  // 1. Set New Password Mode (Clicked link from email)
  if (mode === 'new_password') {
    return (
      <AuthCard title="Set new password" sub={`Create a new password for ${email || 'your account'}`}>
        <form className="col" onSubmit={handleResetWithToken} style={{ gap: 14 }}>
          {!urlEmail ? (
            <Field label="Email">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
          ) : null}

          <Field label="New password" hint="At least 10 characters">
            {(id) => (
              <Input
                id={id}
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            )}
          </Field>

          <Field label="Confirm new password">
            {(id) => (
              <Input
                id={id}
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            )}
          </Field>

          <ErrorNote error={error} />

          <Btn type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Update password'}
          </Btn>

          <div className="small" style={{ textAlign: 'center', marginTop: 4 }}>
            <Link href="/login">Back to sign in</Link>
          </div>
        </form>
      </AuthCard>
    );
  }

  // 2. Admin Code Fallback Mode
  if (mode === 'admin_code') {
    return (
      <AuthCard title="Admin reset code" sub="Enter the one-time code provided by your family admin">
        <form className="col" onSubmit={handleResetWithAdminCode} style={{ gap: 14 }}>
          <Field label="Email">
            {(id) => (
              <Input
                id={id}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>

          <Field label="One-time reset code">
            {(id) => (
              <Input
                id={id}
                required
                placeholder="e.g. ABCD-1234"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                autoComplete="one-time-code"
              />
            )}
          </Field>

          <Field label="New password" hint="At least 10 characters">
            {(id) => (
              <Input
                id={id}
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            )}
          </Field>

          <ErrorNote error={error} />

          <Btn type="submit" disabled={busy}>
            {busy ? 'Updating…' : 'Change password'}
          </Btn>

          <div className="row between" style={{ fontSize: 13, marginTop: 4 }}>
            <button
              type="button"
              className="btn ghost sm"
              style={{ color: 'var(--brand)', padding: '4px 0' }}
              onClick={() => { setMode('request_link'); setError(null); }}
            >
              Email me a reset link instead
            </button>
            <Link href="/login" style={{ color: 'var(--muted)' }}>Back to sign in</Link>
          </div>
        </form>
      </AuthCard>
    );
  }

  // 3. Default: Request Reset Link via Email
  return (
    <AuthCard
      title="Reset your password"
      sub="Enter your email address and we'll send you a link to reset your password"
    >
      {sentSuccess ? (
        <div className="col" style={{ gap: 16, textAlign: 'center', padding: '10px 0' }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: '#D1FAE5',
              color: '#065F46',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>Check your email</h3>
            <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
              We&apos;ve sent a password reset link to <b>{email}</b>. Please check your inbox and spam folder.
            </p>
          </div>
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setSentSuccess(false)}
            >
              Send again with another email
            </button>
          </div>
          <div className="small" style={{ marginTop: 10 }}>
            <Link href="/login" style={{ fontWeight: 600 }}>Back to sign in</Link>
          </div>
        </div>
      ) : (
        <form className="col" onSubmit={handleRequestLink} style={{ gap: 14 }}>
          <Field label="Your account email">
            {(id) => (
              <Input
                id={id}
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>

          <ErrorNote error={error} />

          <Btn type="submit" disabled={busy}>
            {busy ? 'Sending link…' : 'Send password reset link'}
          </Btn>

          <div className="row between" style={{ fontSize: 13, marginTop: 4 }}>
            <button
              type="button"
              className="btn ghost sm"
              style={{ color: 'var(--muted)', padding: '4px 0', fontSize: 12.5 }}
              onClick={() => { setMode('admin_code'); setError(null); }}
            >
              Use admin reset code
            </button>
            <Link href="/login">Back to sign in</Link>
          </div>
        </form>
      )}
    </AuthCard>
  );
}
