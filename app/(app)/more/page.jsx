'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth, useData } from '@/lib/auth';
import { applyTheme, getSavedTheme } from '@/lib/theme';
import { getAllPermissions, requestNotifications } from '@/lib/permissions';
import { useToast } from '@/components/ui';

export default function MorePage() {
  const { user, family, signOut, lang, setLang } = useAuth();
  const toast = useToast();
  const [themePref, setThemePref] = useState('light');
  const [perms, setPerms] = useState({ notifications: 'prompt' });

  const medData = useData('/medicines/today');
  const medDueCount = medData.data?.filter((m) => m.status !== 'given').length || 1;
  const memberCount = family?.members?.length || 1;

  useEffect(() => {
    setThemePref(getSavedTheme());
    getAllPermissions().then(setPerms).catch(() => {});
  }, []);

  const toggleTheme = () => {
    const next = themePref === 'light' ? 'dark' : themePref === 'dark' ? 'system' : 'light';
    setThemePref(next);
    applyTheme(next);
  };

  const toggleLanguage = () => {
    const langs = ['ml', 'en', 'hi', 'ta'];
    const idx = langs.indexOf(lang || 'ml');
    const next = langs[(idx + 1) % langs.length];
    setLang(next);
  };

  const toggleNotifs = async () => {
    try {
      const res = await requestNotifications();
      setPerms((prev) => ({ ...prev, notifications: res }));
      if (res === 'granted') toast('Notifications enabled');
    } catch {}
  };

  const installApp = () => {
    if (typeof window !== 'undefined' && window.deferredPrompt) {
      window.deferredPrompt.prompt();
    } else {
      toast('Tap Share (Safari) or Menu (Chrome) -> "Add to Home Screen".');
    }
  };

  const langNames = { ml: 'മലയാളം', en: 'English', hi: 'हिन्दी', ta: 'தமிழ்' };
  const themeNames = { light: 'Light', dark: 'Dark', system: 'System' };

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header: ME */}
      <div className="section-label" style={{ marginBottom: 20 }}>
        ME
      </div>

      {/* User Info Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <span
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--brand)',
            color: 'var(--on-brand)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {(user?.name || 'A')[0].toUpperCase()}
        </span>
        <div>
          <div className="editorial-h2" style={{ fontSize: 24, margin: 0 }}>
            {user?.name || 'Anandhu'}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {user?.email || 'connect.anandhukannan@gmail.com'}
          </div>
        </div>
      </div>

      {/* Core Family Links */}
      <div className="col" style={{ gap: 0, marginBottom: 32 }}>
        <Link
          href="/medicine"
          className="row between"
          style={{ padding: '16px 0', textDecoration: 'none', color: 'var(--text)' }}
        >
          <span style={{ fontSize: 15.5, fontWeight: 500 }}>Medicine</span>
          <span className="muted" style={{ fontSize: 14 }}>
            {medDueCount} today ›
          </span>
        </Link>
        <hr className="editorial-divider" />

        <Link
          href="/documents"
          className="row between"
          style={{ padding: '16px 0', textDecoration: 'none', color: 'var(--text)' }}
        >
          <span style={{ fontSize: 15.5, fontWeight: 500 }}>Documents</span>
          <span className="muted" style={{ fontSize: 14 }}>
            ›
          </span>
        </Link>
        <hr className="editorial-divider" />

        <Link
          href="/special-days"
          className="row between"
          style={{ padding: '16px 0', textDecoration: 'none', color: 'var(--text)' }}
        >
          <span style={{ fontSize: 15.5, fontWeight: 500 }}>Special days</span>
          <span className="muted" style={{ fontSize: 14 }}>
            ›
          </span>
        </Link>
        <hr className="editorial-divider" />

        <Link
          href="/family"
          className="row between"
          style={{ padding: '16px 0', textDecoration: 'none', color: 'var(--text)' }}
        >
          <span style={{ fontSize: 15.5, fontWeight: 500 }}>Family</span>
          <span className="muted" style={{ fontSize: 14 }}>
            {memberCount} member{memberCount === 1 ? '' : 's'} ›
          </span>
        </Link>
        <hr className="editorial-divider" />
      </div>

      {/* Section: SETTINGS */}
      <div className="section-label" style={{ marginBottom: 16 }}>
        SETTINGS
      </div>

      <div className="col" style={{ gap: 0, marginBottom: 36 }}>
        {/* Language */}
        <div
          onClick={toggleLanguage}
          role="button"
          tabIndex={0}
          className="row between"
          style={{ padding: '16px 0', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 15.5, fontWeight: 500 }}>Language</span>
          <span className="muted" style={{ fontSize: 14 }}>
            {langNames[lang] || 'മലയാളം'} ›
          </span>
        </div>
        <hr className="editorial-divider" />

        {/* Appearance */}
        <div
          onClick={toggleTheme}
          role="button"
          tabIndex={0}
          className="row between"
          style={{ padding: '16px 0', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 15.5, fontWeight: 500 }}>Appearance</span>
          <span className="muted" style={{ fontSize: 14 }}>
            {themeNames[themePref] || 'Light'} ›
          </span>
        </div>
        <hr className="editorial-divider" />

        {/* Notifications */}
        <div className="row between" style={{ padding: '16px 0' }}>
          <span style={{ fontSize: 15.5, fontWeight: 500 }}>Notifications</span>
          {perms.notifications === 'granted' ? (
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>On</span>
          ) : (
            <button
              type="button"
              className="editorial-link"
              onClick={toggleNotifs}
              style={{ fontSize: 13.5 }}
            >
              Off · Turn on
            </button>
          )}
        </div>
        <hr className="editorial-divider" />

        {/* Install Hommi */}
        <div className="row between" style={{ padding: '16px 0' }}>
          <span style={{ fontSize: 15.5, fontWeight: 500 }}>Install Hommi</span>
          <button
            type="button"
            className="editorial-link"
            onClick={installApp}
            style={{ fontSize: 13.5 }}
          >
            Install
          </button>
        </div>
        <hr className="editorial-divider" />
      </div>

      {/* Sign out */}
      <div>
        <button
          type="button"
          onClick={signOut}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--accent-terracotta)',
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
