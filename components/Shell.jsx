'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth, useData } from '@/lib/auth';
import { Icon, Sheet, Btn, Badge } from '@/components/ui';
import { applyTheme, getSavedTheme } from '@/lib/theme';
import PermissionsPrompt from '@/components/PermissionsPrompt';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';

const NAV = [
  ['/dashboard', 'nav.home', 'home'], ['/calendar', 'nav.calendar', 'calendar'], ['/tasks', 'nav.tasks', 'tasks'], ['/bills', 'nav.bills', 'bills'], ['/money', 'nav.money', 'money'],
  ['/grocery', 'nav.grocery', 'grocery'], ['/meals', 'nav.meals', 'meals'], ['/recipes', 'nav.recipes', 'meals'], ['/documents', 'nav.documents', 'docs'], ['/medicine', 'nav.medicine', 'med'],
  ['/special-days', 'nav.days', 'days'], ['/chat', 'nav.chat', 'chat'], ['/family', 'nav.family', 'family'], ['/settings', 'nav.settings', 'settings'],
];
const TABS = [
  ['/dashboard', 'nav.home', 'home'],
  ['/chat', 'nav.chat', 'chat'],
  ['/tasks', 'nav.tasks', 'tasks'],
  ['/bills', 'nav.bills', 'bills'],
  ['/more', 'nav.more', 'menu'],
];

function FamilySwitcher({ onClose }) {
  const { families, familyId, switchFamily, t } = useAuth();
  const router = useRouter();
  const go = async (id) => { await switchFamily(id); onClose(); router.push('/dashboard'); };
  return (
    <Sheet title={t('shell.switch_family')} onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>{t('shell.switch_sub')}</p>
      <div className="col">
        {families.map((f) => (
          <button key={f.id} type="button" onClick={() => go(f.id)} aria-pressed={f.id === familyId} className="card" style={{ textAlign: 'left', cursor: 'pointer', border: f.id === familyId ? '2px solid var(--brand)' : '1px solid var(--line)', background: f.id === familyId ? 'var(--brand-soft)' : 'var(--surface)' }}>
            <div className="row between">
              <div className="row" style={{ gap: 10 }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <img src="/icon.svg?v=2" alt="Family" width="24" height="24" style={{ objectFit: 'contain' }} />
                </span>
                <div><div className="bold">{f.name}</div><div className="small muted">{f.myRole} · {f.memberCount} member{f.memberCount === 1 ? '' : 's'}</div></div>
              </div>
              <div className="row">{f.openTasksForMe ? <Badge tone="warn">{f.openTasksForMe} task{f.openTasksForMe === 1 ? '' : 's'}</Badge> : null}{f.billsDue ? <Badge tone="danger">{f.billsDue} bill due</Badge> : null}{f.unreadChat ? <Badge tone="info">{f.unreadChat} chat</Badge> : null}</div>
            </div>
          </button>
        ))}
        <button type="button" className="card" style={{ textAlign: 'left', cursor: 'pointer', border: '1px dashed var(--muted)' }} onClick={() => { onClose(); router.push('/all'); }}>
          <div className="bold">{t('shell.all_families')}</div><div className="small muted">{t('shell.all_families_sub')}</div>
        </button>
        <div className="row"><Btn tone="ghost" className="grow" onClick={() => { onClose(); router.push('/onboarding?mode=create'); }}>{t('shell.create_family')}</Btn><Btn className="grow" onClick={() => { onClose(); router.push('/onboarding?mode=join'); }}>{t('shell.join_code')}</Btn></div>
      </div>
    </Sheet>
  );
}

export default function Shell({ children }) {
  const { family, families, familyId, t, user } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const notes = useData('/me/notifications', { interval: 60000 });
  const unread = notes.data?.unread || 0;
  const chatUnread = families.find((f) => f.id === familyId)?.unreadChat || 0;
  const active = (href) => (path === href || (href !== '/dashboard' && path.startsWith(`${href}/`)) ? 'page' : undefined);

  useEffect(() => {
    const saved = getSavedTheme();
    applyTheme(saved);

    const media = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e) => {
      if (getSavedTheme() === 'system') {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    };
    if (media?.addEventListener) {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, []);

  const switcher = (
    <button type="button" onClick={() => setOpen(true)} className="row" aria-label="Switch family" style={{ minHeight: 44, padding: '0 14px', border: '1px solid var(--line)', borderRadius: 999, background: 'var(--surface)', fontWeight: 700, cursor: 'pointer', gap: 10 }}>
      <span
        style={{
          width: 24,
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <img src="/icon.svg?v=2" alt="Home" width="22" height="22" style={{ objectFit: 'contain' }} />
      </span>
      <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{family?.name || 'Family'}</span>
      <Icon name="swap" size={16} />
    </button>
  );
  const bell = (
    <Link href="/notifications" className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} new` : ''}`}>
      <Icon name="bell" />{unread ? <span className="count">{unread > 9 ? '9+' : unread}</span> : null}
    </Link>
  );

  return (
    <div className="shell">
      <aside className="side" aria-label="Main navigation">
        <div className="row between" style={{ marginBottom: 10 }}>
          {switcher}
          <div className="row" style={{ gap: 6 }}>
            {bell}
          </div>
        </div>
        {NAV.map(([href, key, icon]) => (
          <Link key={href} href={href} className="navlink" aria-current={active(href)}>
            <span className="row"><Icon name={icon} size={20} />{t(key)}</span>
            {href === '/chat' && chatUnread ? <span className="badge danger">{chatUnread}</span> : null}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
        <Link
          href="/settings"
          className="row between"
          style={{
            padding: '10px 12px',
            color: 'var(--text)',
            textDecoration: 'none',
            borderRadius: 12,
            background: path === '/settings' ? 'var(--brand-soft)' : 'transparent',
            transition: 'background 0.15s ease',
          }}
          title="Account & Settings"
        >
          <div className="row" style={{ gap: 8 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--brand)',
                color: 'var(--on-brand)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {(user?.name || 'U')[0].toUpperCase()}
            </span>
            <span className="small bold" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || 'User'}
            </span>
          </div>
          <Icon name="settings" size={16} />
        </Link>
      </aside>
      <div style={{ flex: 1, minWidth: 0 }}>
        <main className={`main ${path === '/chat' ? 'main-chat' : ''}`}>
          <div className="topbar mobile-only">
            {switcher}
            <div className="row" style={{ gap: 6 }}>
              {bell}
            </div>
          </div>
          {children}
        </main>
        <nav className="tabbar mobile-only" aria-label="Main navigation">
          {TABS.map(([href, key, icon]) => {
            const isMoreActive = href === '/more' && ['/more', '/settings', '/calendar', '/money', '/grocery', '/meals', '/documents', '/medicine', '/special-days', '/family', '/recipes'].some((p) => path.startsWith(p));
            const isCurrent = Boolean(isMoreActive || active(href));
            return (
              <Link
                key={href}
                href={href}
                className={`tab ${isCurrent ? 'active' : ''}`}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={t(key)}
              >
                <span className="tab-icon-wrap">
                  <Icon name={icon} size={isCurrent ? 18 : 20} />
                  {href === '/chat' && chatUnread ? <span className="tab-unread-dot" /> : null}
                </span>
                {isCurrent ? <span className="tab-label">{t(key)}</span> : null}
              </Link>
            );
          })}
        </nav>
      </div>
      {open ? <FamilySwitcher onClose={() => setOpen(false)} /> : null}
      <PermissionsPrompt />
      <PwaInstallPrompt />
    </div>
  );
}
