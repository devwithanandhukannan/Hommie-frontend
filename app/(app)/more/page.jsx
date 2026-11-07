'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Icon, PageHeader } from '@/components/ui';

export default function More() {
  const { signOut, t } = useAuth();

  const items = [
    ['/calendar', t('nav.calendar'), t('more.sub_cal') || t('more.calendar_sub'), 'calendar'],
    ['/money', t('nav.money'), t('more.sub_money') || t('more.money_sub'), 'money'],
    ['/grocery', t('nav.grocery'), t('more.sub_grocery') || t('more.grocery_sub'), 'grocery'],
    ['/meals', t('nav.meals'), t('more.sub_meals') || t('more.meals_sub'), 'meals'],
    ['/recipes', t('nav.recipes'), t('more.sub_recipes') || t('more.recipes_sub'), 'meals'],
    ['/documents', t('nav.documents'), t('more.sub_docs') || t('more.documents_sub'), 'docs'],
    ['/medicine', t('nav.medicine'), t('more.sub_med') || t('more.medicine_sub'), 'med'],
    ['/special-days', t('nav.days'), t('more.sub_days') || t('more.days_sub'), 'days'],
    ['/family', t('nav.family'), t('more.sub_family') || t('more.family_sub'), 'family'],
    ['/settings', t('nav.settings'), t('more.sub_settings') || t('more.settings_sub'), 'settings'],
  ];

  return (
    <>
      <PageHeader title={t('more.title')} />
      <div className="card list">
        {items.map(([href, label, sub, icon]) => (
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
      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn ghost" onClick={signOut}>
          {t('btn.signout')}
        </button>
      </div>
    </>
  );
}
