'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/ui';

function Row({ href, icon, title, sub, onClick }) {
  const inner = (
    <>
      <span className="moment-icon"><Icon name={icon} size={22} /></span>
      <span className="grow"><span style={{ display: 'block' }}>{title}</span>{sub ? <span className="small muted" style={{ display: 'block', fontWeight: 400 }}>{sub}</span> : null}</span>
      <span className="acc-btn" aria-hidden="true">›</span>
    </>
  );
  return (
    <div className="acc-item">
      {href ? <Link href={href} className="acc-head" style={{ textDecoration: 'none' }}>{inner}</Link> : <button type="button" className="acc-head" onClick={onClick}>{inner}</button>}
    </div>
  );
}

export default function More() {
  const { signOut, t, user, family } = useAuth();
  const router = useRouter();
  return (
    <div>
      <h1 className="today-hello">{t('more.title')}</h1>
      <p className="today-sentence">{family?.name} · {user?.name}</p>
      <div className="acc">
        <Row href="/medicine" icon="med" title={t('nav.medicine')} sub={t('more.sub_med')} />
        <Row href="/documents" icon="docs" title={t('nav.documents')} sub={t('more.sub_docs')} />
        <Row href="/special-days" icon="days" title={t('nav.days')} sub={t('more.sub_days')} />
        <Row href="/family" icon="family" title={t('nav.family')} sub={t('more.sub_family')} />
        <Row href="/settings" icon="settings" title={t('nav.settings')} sub={t('more.sub_settings')} />
        <Row icon="back" title={t('btn.signout')} onClick={async () => { await signOut(); router.replace('/'); }} />
      </div>
    </div>
  );
}
