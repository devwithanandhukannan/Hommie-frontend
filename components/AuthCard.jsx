'use client';
import { useAuth } from '@/lib/auth';

const LANGS = [['en', 'English'], ['ml', 'മലയാളം'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்']];

export function AuthCard({ title, sub, children }) {
  const { lang, setLang } = useAuth();
  return (
    <div className="auth"><div className="card">
      <div className="logo" style={{ background: 'transparent', width: 56, height: 56, borderRadius: 0, padding: 0, marginBottom: 12 }}>
        <img src="/icon.svg?v=2" alt="Hommi" width="56" height="56" style={{ display: 'block', objectFit: 'contain' }} />
      </div>
      <h1>{title}</h1><p className="muted" style={{ margin: '4px 0 16px' }}>{sub}</p>
      {children}
      <div className="lang-pick" role="group" aria-label="Language">
        {LANGS.map(([code, label]) => <button key={code} type="button" className={code === lang ? 'on' : ''} aria-pressed={code === lang} onClick={() => setLang(code)}>{label}</button>)}
      </div>
    </div></div>
  );
}
