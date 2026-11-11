'use client';
import { useAuth } from '@/lib/auth';
import { useServerStatus } from '@/lib/serverStatus';
import { SystemBootScreen } from '@/components/ui';

const LANGS = [['en', 'English'], ['ml', 'മലയാളം'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்']];

export function AuthCard({ title, sub, children }) {
  const { lang, setLang, t } = useAuth();
  const { isBooting } = useServerStatus();
  return (
    <div className="auth"><div className="card">
      <div className="logo" style={{ background: 'transparent', width: 56, height: 56, borderRadius: 0, padding: 0, marginBottom: 12 }}>
        <img src="/icon.svg?v=2" alt="Hommi" width="56" height="56" style={{ display: 'block', objectFit: 'contain' }} />
      </div>
      {isBooting ? (
        <SystemBootScreen inline title={t('common.booting_title')} sub={t('common.booting_sub')} />
      ) : (
        <>
          <h1>{title}</h1><p className="muted" style={{ margin: '4px 0 16px' }}>{sub}</p>
          {children}
        </>
      )}
      <div className="lang-pick" role="group" aria-label="Language">
        {LANGS.map(([code, label]) => <button key={code} type="button" className={code === lang ? 'on' : ''} aria-pressed={code === lang} onClick={() => setLang(code)}>{label}</button>)}
      </div>
    </div></div>
  );
}
