'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { patch } from '@/lib/api';
import { PageHeader, Btn, Field, Input, Icon, Spinner, Switch, useAction, useToast } from '@/components/ui';
import { applyTheme, getSavedTheme } from '@/lib/theme';
import { languages } from '@/lib/i18n';
import { getAllPermissions, requestMicrophone, requestCamera, requestNotifications } from '@/lib/permissions';

export default function SettingsPage() {
  const { user, setUser, t, setLang, lang, signOut } = useAuth();
  const toast = useToast();
  const [run, busy] = useAction();

  // Theme state: 'light' | 'dark' | 'system'
  const [themePref, setThemePref] = useState('system');

  // Language state: 'en' | 'hi' | 'ta' | 'ml'
  const [langPref, setLangPref] = useState(lang || 'en');

  // Permissions state
  const [perms, setPerms] = useState({ microphone: 'prompt', camera: 'prompt', notifications: 'prompt' });

  // User name edit state
  const [name, setName] = useState('');

  useEffect(() => {
    setThemePref(getSavedTheme());
    setLangPref(lang || user?.language || 'en');
    setName(user?.name || '');
    getAllPermissions().then(setPerms).catch(() => {});
  }, [user, lang]);

  const toggleMicrophone = async () => {
    if (perms.microphone === 'granted') {
      toast('To revoke permission, reset it in your browser address bar settings (🔒 icon).');
      return;
    }
    try {
      const res = await requestMicrophone();
      setPerms((prev) => ({ ...prev, microphone: res }));
      if (res === 'granted') toast('Microphone access enabled');
      else toast('Microphone access blocked in browser');
    } catch {
      toast('Microphone unavailable or blocked');
    }
  };

  const toggleCamera = async () => {
    if (perms.camera === 'granted') {
      toast('To revoke permission, reset it in your browser address bar settings (🔒 icon).');
      return;
    }
    try {
      const res = await requestCamera();
      setPerms((prev) => ({ ...prev, camera: res }));
      if (res === 'granted') toast('Camera access enabled');
      else toast('Camera access blocked in browser');
    } catch {
      toast('Camera unavailable or blocked');
    }
  };

  const toggleNotifications = async () => {
    if (perms.notifications === 'granted') {
      toast('To revoke notifications, reset it in your browser address bar settings (🔒 icon).');
      return;
    }
    try {
      const res = await requestNotifications();
      setPerms((prev) => ({ ...prev, notifications: res }));
      if (res === 'granted') toast('Notifications enabled');
      else toast('Notifications blocked in browser');
    } catch {
      toast('Notifications unavailable or blocked');
    }
  };

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

        {/* 3. Permissions & Privacy (Apple-styled Settings Rows) */}
        <section className="card col" style={{ padding: 22, borderRadius: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, margin: '0 0 4px' }}>{t('settings.permissions')}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {t('settings.permissions_desc')}
            </p>
          </div>

          <div className="col" style={{ gap: 0, marginTop: 12, background: 'var(--surface-2)', borderRadius: 16, overflow: 'hidden' }}>
            {/* Microphone Row */}
            <div className="row between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <div className="row" style={{ gap: 12 }}>
                <span className="setting-perm-icon" style={{ background: 'rgba(52, 199, 89, 0.15)', color: '#34C759' }}>
                  <Icon name="mic" size={18} />
                </span>
                <div>
                  <div className="bold small">{t('settings.microphone')}</div>
                  <div className="tiny muted">{t('settings.microphone_desc')}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <span className={`tiny bold ${perms.microphone === 'granted' ? 'color-ok' : perms.microphone === 'denied' ? 'color-danger' : 'muted'}`}>
                  {perms.microphone === 'granted' ? t('settings.status_allowed') : perms.microphone === 'denied' ? t('settings.status_blocked') : t('settings.status_not_set')}
                </span>
                <Switch
                  checked={perms.microphone === 'granted'}
                  onChange={toggleMicrophone}
                  ariaLabel={t('settings.microphone')}
                />
              </div>
            </div>

            {/* Camera Row */}
            <div className="row between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <div className="row" style={{ gap: 12 }}>
                <span className="setting-perm-icon" style={{ background: 'rgba(0, 113, 227, 0.15)', color: '#0071E3' }}>
                  <Icon name="photo" size={18} />
                </span>
                <div>
                  <div className="bold small">{t('settings.camera')}</div>
                  <div className="tiny muted">{t('settings.camera_desc')}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <span className={`tiny bold ${perms.camera === 'granted' ? 'color-ok' : perms.camera === 'denied' ? 'color-danger' : 'muted'}`}>
                  {perms.camera === 'granted' ? t('settings.status_allowed') : perms.camera === 'denied' ? t('settings.status_blocked') : t('settings.status_not_set')}
                </span>
                <Switch
                  checked={perms.camera === 'granted'}
                  onChange={toggleCamera}
                  ariaLabel={t('settings.camera')}
                />
              </div>
            </div>

            {/* Notifications Row */}
            <div className="row between" style={{ padding: '14px 16px' }}>
              <div className="row" style={{ gap: 12 }}>
                <span className="setting-perm-icon" style={{ background: 'rgba(255, 149, 0, 0.15)', color: '#FF9500' }}>
                  <Icon name="bell" size={18} />
                </span>
                <div>
                  <div className="bold small">{t('settings.notifications')}</div>
                  <div className="tiny muted">{t('settings.notifications_desc')}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <span className={`tiny bold ${perms.notifications === 'granted' ? 'color-ok' : perms.notifications === 'denied' ? 'color-danger' : 'muted'}`}>
                  {perms.notifications === 'granted' ? t('settings.status_allowed') : perms.notifications === 'denied' ? t('settings.status_blocked') : t('settings.status_not_set')}
                </span>
                <Switch
                  checked={perms.notifications === 'granted'}
                  onChange={toggleNotifications}
                  ariaLabel={t('settings.notifications')}
                />
              </div>
            </div>
          </div>
        </section>

        {/* PWA Mobile App Section */}
        <section className="card col" style={{ padding: 22, borderRadius: 20 }}>
          <div className="row between" style={{ alignItems: 'center' }}>
            <div className="row" style={{ gap: 14 }}>
              <img
                src="/apple-touch-icon.png?v=2"
                alt="Hommi App"
                width={44}
                height={44}
                style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              />
              <div>
                <div className="bold small">Hommi on your Mobile Phone</div>
                <div className="tiny muted">Install as a full-screen app on your Home Screen</div>
              </div>
            </div>
            <Btn
              tone="brand"
              size="sm"
              onClick={() => {
                window.dispatchEvent(new Event('open-pwa-install'));
              }}
            >
              Install App
            </Btn>
          </div>
        </section>

        {/* 4. Account Settings */}
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

