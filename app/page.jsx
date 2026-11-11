'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useServerStatus } from '@/lib/serverStatus';
import { SystemBootScreen } from '@/components/ui';
import { afterAuthPath } from '@/lib/joinFlow';

const LANGS = [['en', 'EN'], ['ml', 'മല'], ['hi', 'हि'], ['ta', 'த']];

// Thin line icons: no words, no clutter.
const Line = ({ d, children }) => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children || <path d={d} />}</svg>
);
const IconPlan = () => <Line><rect x="9" y="8" width="26" height="30" rx="7" /><path d="M16 19l3 3 6-7M16 30h12" /></Line>;
const IconShare = () => <Line><circle cx="15" cy="17" r="5" /><circle cx="30" cy="19" r="4" /><path d="M6 36c1-6 5-9 9-9s8 3 9 9M25 36c1-4 3-6 6-6s5 2 6 6" /></Line>;
const IconCare = () => <Line><path d="M22 36S8 28 8 18a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 10-14 18-14 18z" /></Line>;

export default function Landing() {
  const { status, families, t, lang, setLang } = useAuth();
  const { isBooting, isWakingUp } = useServerStatus();
  const router = useRouter();
  useEffect(() => { if (status === 'authed') router.replace(afterAuthPath(families)); }, [status, families, router]);
  if (status === 'loading' && (isBooting || isWakingUp)) {
    return <SystemBootScreen title={t('common.booting_title')} sub={t('common.booting_sub')} />;
  }

  const cards = [['01', t('land.plan'), t('land.p1'), <IconPlan key="a" />], ['02', t('land.share'), t('land.p2'), <IconShare key="b" />], ['03', t('land.care'), t('land.p3'), <IconCare key="c" />]];

  return (
    <div className="lp">
      <header className="lp-nav">
        <span className="lp-mark"><img src="/icon.svg?v=2" alt="" width="26" height="26" />Hommi</span>
        <nav className="lp-nav-r" aria-label="Language and sign in">
          <span className="lp-langs" role="group" aria-label="Language">
            {LANGS.map(([c, label]) => <button key={c} type="button" className={c === lang ? 'on' : ''} aria-pressed={c === lang} onClick={() => setLang(c)}>{label}</button>)}
          </span>
          <Link href="/login" className="lp-link">{t('auth.signin')}</Link>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-bars" aria-hidden="true">{[36, 54, 74, 96, 66, 84, 48].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
          <h1 className="lp-title">{t('land.title')}</h1>
          <p className="lp-sub">{t('land.sub')}</p>
          <div className="lp-cta">
            <Link href="/register" className="btn lp-btn">{t('land.start')}</Link>
            <Link href="/login" className="btn ghost lp-btn">{t('auth.signin')}</Link>
          </div>
        </section>

        <section className="lp-glimpse" aria-hidden="true">
          <div className="lp-device">
            <div className="lp-wk">{[12, 13, 14, 15, 16, 17, 18].map((n) => <span key={n} className={n === 15 ? 'on' : ''}>{n}</span>)}</div>
            <div className="lp-goal"><b>70<small>%</small></b><span className="dots">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < 7 ? 'on' : ''} />)}</span></div>
            {[0, 1].map((r) => <div key={r} className="lp-row"><span><i style={{ width: r ? '46%' : '62%' }} /><i className="s" style={{ width: '30%' }} /></span><em /></div>)}
          </div>
        </section>

        <section className="lp-dark">
          <div className="lp-cards">
            {cards.map(([n, word, line, icon]) => (
              <article key={n} className="lp-card">
                <span className="lp-n">{n}</span>
                {icon}
                <h2>{word}</h2>
                <p>{line}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-final">
          <h2>{t('land.final')}</h2>
          <Link href="/register" className="btn lp-btn">{t('land.start')}</Link>
        </section>
      </main>

      <footer className="lp-foot">Hommi · {t('land.private')}</footer>
    </div>
  );
}
