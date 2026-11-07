'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Icon, PageHeader } from '@/components/ui';

export default function More() {
  const { signOut, t, lang, user, family } = useAuth();

  const familyItems = [
    ['/medicine', t('nav.medicine'), t('more.sub_med') || 'Medicine schedules and reminders', 'med'],
    ['/documents', t('nav.documents'), t('more.sub_docs') || 'Encrypted family vault', 'docs'],
    ['/special-days', t('nav.days'), t('more.sub_days') || 'Birthdays and anniversaries', 'days'],
    ['/family', t('nav.family'), t('more.sub_family') || 'Members and permissions', 'family'],
  ];

  const quickPillars = [
    ['/planner', t('nav.planner') || 'Planner', 'Tasks, groceries, meals, and calendar', 'tasks'],
    ['/money', t('nav.money') || 'Money & Bills', 'Expenses, bills, loans, and wallet', 'money'],
  ];

  const systemItems = [
    ['/settings', t('nav.settings'), t('more.sub_settings') || 'Language, theme, notifications', 'settings'],
  ];

  return (
    <>
      <PageHeader
        title={lang === 'ml' ? 'കൂടുതൽ കാര്യങ്ങൾ' : t('more.title')}
        sub={`${family?.name || 'Family'} · ${user?.name || 'Account'}`}
      />

      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', margin: '16px 0 8px 4px', letterSpacing: '0.04em' }}>
        {lang === 'ml' ? 'പ്രധാന വിഭാഗങ്ങൾ' : 'Main Pillars'}
      </div>
      <div className="card list">
        {quickPillars.map(([href, label, sub, icon]) => (
          <Link key={href} href={href} className="item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Icon name={icon} />
            <div className="grow">
              <div className="bold">{label}</div>
              <div className="small muted">{sub}</div>
            </div>
            <span aria-hidden="true">›</span>
          </Link>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', margin: '20px 0 8px 4px', letterSpacing: '0.04em' }}>
        {lang === 'ml' ? 'ആരോഗ്യവും രേഖകളും' : 'Health & Records'}
      </div>
      <div className="card list">
        {familyItems.map(([href, label, sub, icon]) => (
          <Link key={href} href={href} className="item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Icon name={icon} />
            <div className="grow">
              <div className="bold">{label}</div>
              <div className="small muted">{sub}</div>
            </div>
            <span aria-hidden="true">›</span>
          </Link>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', margin: '20px 0 8px 4px', letterSpacing: '0.04em' }}>
        {lang === 'ml' ? 'ക്രമീകരണങ്ങൾ' : 'Preferences'}
      </div>
      <div className="card list">
        {systemItems.map(([href, label, sub, icon]) => (
          <Link key={href} href={href} className="item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Icon name={icon} />
            <div className="grow">
              <div className="bold">{label}</div>
              <div className="small muted">{sub}</div>
            </div>
            <span aria-hidden="true">›</span>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <button type="button" className="btn ghost" onClick={signOut}>
          {t('btn.signout')}
        </button>
      </div>
    </>
  );
}
