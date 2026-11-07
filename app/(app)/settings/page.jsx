'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { patch } from '@/lib/api';
import { PageHeader, Btn, Field, Input, Icon, Spinner, useAction, useToast } from '@/components/ui';
import { applyTheme, getSavedTheme } from '@/lib/theme';
import { languages } from '@/lib/i18n';

export default function SettingsPage() {
  const { user, setUser, t, setLang, lang, signOut } = useAuth();
  const toast = useToast();
  const [run, busy] = useAction();

  // Theme state: 'light' | 'dark' | 'system'
  const [themePref, setThemePref] = useState('system');

  // Language state: 'en' | 'hi' | 'ta' | 'ml'
  const [langPref, setLangPref] = useState(lang || 'en');

  // User name edit state
  const [name, setName] = useState('');

  useEffect(() => {
    setThemePref(getSavedTheme());
    setLangPref(lang || user?.language || 'en');
    setName(user?.name || '');
  }, [user, lang]);

  const selectTheme = (newTheme) => {
    setThemePref(newTheme);
    applyTheme(newTheme);
    toast(`Theme changed to ${newTheme === 'system' ? 'System default' : newTheme}`);
  };

  const selectLanguage = async (code) => {
    setLangPref(code);
    setLang(code);
    setUser((prev) => (prev ? { ...prev, language: code } : prev));
    try {
      await patch('/me', { language: code });
      toast('Language updated');
    } catch {
      // Local fallback saved anyway
      toast('Language updated locally');
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (await run(async () => {
      const u = await patch('/me', { name: trimmed });
      setUser((prev) => ({ ...prev, ...u }));
    }, 'Profile updated')) {
      toast('Account name updated');
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
      <PageHeader
        title={t('settings.title')}
        sub={t('settings.sub')}
      />

      <div className="col" style={{ gap: 20 }}>
        {/* 1. Appearance / Theme */}
        <section className="card col" style={{ padding: 22, borderRadius: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>{t('settings.appearance')}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {t('settings.theme_desc')}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginTop: 10,
            }}
          >
            {/* Light Mode Option */}
            <button
              type="button"
              className={`theme-option-card ${themePref === 'light' ? 'active' : ''}`}
              onClick={() => selectTheme('light')}
              aria-pressed={themePref === 'light'}
            >
              <div className="theme-option-preview preview-light">
                <Icon name="sun" size={24} />
              </div>
              <div className="theme-option-meta">
                <span className="bold" style={{ fontSize: 13.5 }}>{t('settings.theme_light')}</span>
                <span className="tiny muted">Clean white Apple UI</span>
              </div>
              {themePref === 'light' ? (
                <span className="theme-option-check">
                  <Icon name="check" size={14} />
                </span>
              ) : null}
            </button>

            {/* Dark Mode Option */}
            <button
              type="button"
              className={`theme-option-card ${themePref === 'dark' ? 'active' : ''}`}
              onClick={() => selectTheme('dark')}
              aria-pressed={themePref === 'dark'}
            >
              <div className="theme-option-preview preview-dark">
                <Icon name="moon" size={24} />
              </div>
              <div className="theme-option-meta">
                <span className="bold" style={{ fontSize: 13.5 }}>{t('settings.theme_dark')}</span>
                <span className="tiny muted">True pitch black</span>
              </div>
              {themePref === 'dark' ? (
                <span className="theme-option-check">
                  <Icon name="check" size={14} />
                </span>
              ) : null}
            </button>

            {/* System Default Option */}
            <button
              type="button"
              className={`theme-option-card ${themePref === 'system' ? 'active' : ''}`}
              onClick={() => selectTheme('system')}
              aria-pressed={themePref === 'system'}
            >
              <div className="theme-option-preview preview-system">
                <div className="preview-split-icon">
                  <span className="split-sun"><Icon name="sun" size={16} /></span>
                  <span className="split-moon"><Icon name="moon" size={16} /></span>
                </div>
              </div>
              <div className="theme-option-meta">
                <span className="bold" style={{ fontSize: 13.5 }}>{t('settings.theme_system')}</span>
                <span className="tiny muted">Matches device OS setting</span>
              </div>
              {themePref === 'system' ? (
                <span className="theme-option-check">
                  <Icon name="check" size={14} />
                </span>
              ) : null}
            </button>
          </div>
        </section>

        {/* 2. Language Selection */}
        <section className="card col" style={{ padding: 22, borderRadius: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>{t('settings.language')}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {t('settings.language_desc')}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10,
              marginTop: 10,
            }}
          >
            {languages.map((l) => {
              const isSelected = langPref === l.code;
              return (
                <button
                  key={l.code}
                  type="button"
                  className={`lang-option-card ${isSelected ? 'active' : ''}`}
                  onClick={() => selectLanguage(l.code)}
                  aria-pressed={isSelected}
                >
                  <div className="lang-option-badge">
                    {l.code.toUpperCase()}
                  </div>
                  <div className="lang-option-meta">
                    <span className="bold" style={{ fontSize: 14 }}>{l.native}</span>
                    <span className="tiny muted">{l.name}</span>
                  </div>
                  {isSelected ? (
                    <span className="lang-option-check">
                      <Icon name="check" size={14} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Account Settings */}
        <section className="card col" style={{ padding: 22, borderRadius: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>{t('settings.account')}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              Manage your profile details and sign-in
            </p>
          </div>

          <form onSubmit={saveProfile} className="col" style={{ gap: 14, marginTop: 8 }}>
            <Field label={t('settings.name')}>
              {(id) => (
                <Input
                  id={id}
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              )}
            </Field>

            <Field label={t('settings.email')}>
              {(id) => (
                <Input
                  id={id}
                  disabled
                  value={user?.email || ''}
                  style={{ opacity: 0.65, cursor: 'not-allowed' }}
                />
              )}
            </Field>

            <div className="row between wrap" style={{ marginTop: 8, gap: 12 }}>
              <Btn type="submit" disabled={busy}>
                {t('btn.save')}
              </Btn>

              <button
                type="button"
                className="btn danger ghost"
                onClick={signOut}
              >
                {t('btn.signout')}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

