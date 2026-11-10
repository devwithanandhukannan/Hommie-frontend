'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth, useData } from '@/lib/auth';
import { useServerStatus } from '@/lib/serverStatus';
import { Icon, Sheet, Btn, Badge } from '@/components/ui';
import { applyTheme, getSavedTheme } from '@/lib/theme';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import AddSheet from '@/components/AddSheet';

// Four places, always labelled. Everything you "add" goes through the single centre button.
const MAIN_NAV = [
  ['/dashboard', 'nav.today', 'sun'],
  ['/planner', 'nav.home', 'home'],
  ['/money', 'nav.money', 'money'],
  ['/chat', 'nav.chat', 'chat'],
];

const MORE_NAV = [
  ['/recipes', 'nav.recipes', 'recipes'],
  ['/medicine', 'nav.medicine', 'med'],
  ['/documents', 'nav.documents', 'docs'],
  ['/special-days', 'nav.days', 'days'],
  ['/family', 'nav.family', 'family'],
  ['/settings', 'nav.settings', 'settings'],
];

const TABS_LEFT = MAIN_NAV.slice(0, 2);
const TABS_RIGHT = MAIN_NAV.slice(2);

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
                  <img src="/icon-192.png" alt="Family" width="24" height="24" style={{ objectFit: 'contain', borderRadius: 6 }} />
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
  const { family, families, familyId, t, user, savedView } = useAuth();
  const { isWakingUp } = useServerStatus();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();
  const notes = useData('/me/notifications', { interval: 180000 });
  const unread = notes.data?.unread || 0;
  const chatUnread = families.find((f) => f.id === familyId)?.unreadChat || 0;
  const isTabActive = (href) => {
    if (href === '/dashboard') return path === '/dashboard' ? 'page' : undefined;
    if (href === '/chat') return path === '/chat' ? 'page' : undefined;
    if (href === '/planner') {
      return ['/planner', '/tasks', '/grocery', '/meals', '/recipes', '/calendar'].some((p) => path === p || path.startsWith(`${p}/`)) ? 'page' : undefined;
    }
    if (href === '/money') {
      return ['/money', '/bills'].some((p) => path === p || path.startsWith(`${p}/`)) ? 'page' : undefined;
    }
    if (href === '/more') {
      return ['/more', '/medicine', '/documents', '/special-days', '/family', '/settings'].some((p) => path === p || path.startsWith(`${p}/`)) ? 'page' : undefined;
    }
    return (path === href || path.startsWith(`${href}/`)) ? 'page' : undefined;
  };

  // Deep links: the app-icon shortcut and the join flow can open the add sheet directly (?add=1).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('add') === '1') { setAddOpen(true); q.delete('add'); const rest = q.toString(); window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '')); }
  }, []);

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
        <img src="/icon-192.png" alt="Home" width="22" height="22" style={{ objectFit: 'contain', borderRadius: 6 }} />
      </span>
      <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{family?.name || 'Family'}</span>
      <Icon name="swap" size={16} />
    </button>
  );
  const profile = (
    <Link href="/more" className="icon-btn avatar-btn" aria-label={t('nav.more')}>
      <span>{(user?.name || 'U')[0].toUpperCase()}</span>
    </Link>
  );
  const bell = (
    <Link href="/notifications" className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} new` : ''}`}>
      <Icon name="bell" />{unread ? <span className="count">{unread > 9 ? '9+' : unread}</span> : null}
    </Link>
  );

  const renderTab = ([href, key, icon]) => {
    const isCurrent = Boolean(isTabActive(href));
    return (
      <Link key={href} href={href} className={`tab ${isCurrent ? 'active' : ''}`} aria-current={isCurrent ? 'page' : undefined}>
        <span className="tab-icon-wrap">
          <Icon name={icon} size={22} />
          {href === '/chat' && chatUnread ? <span className="tab-unread-dot" /> : null}
        </span>
        <span className="tab-label">{t(key)}</span>
      </Link>
    );
  };

  return (
    <div className="shell">
      <aside className="side" aria-label="Main navigation">
        <div className="row between" style={{ marginBottom: 10 }}>
          {switcher}
          <div className="row" style={{ gap: 6 }}>
            {bell}
          </div>
        </div>
        <button type="button" className="side-add" onClick={() => setAddOpen(true)}><Icon name="plus" size={18} />{t('nav.add')}</button>
        {MAIN_NAV.map(([href, key, icon]) => (
          <Link key={href} href={href} className="navlink" aria-current={isTabActive(href)}>
            <span className="row"><Icon name={icon} size={20} />{t(key)}</span>
            {href === '/chat' && chatUnread ? <span className="badge danger">{chatUnread}</span> : null}
          </Link>
        ))}
        <div style={{ margin: '14px 0 6px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.04em' }}>
          {t('nav.more')}
        </div>
        {MORE_NAV.map(([href, key, icon]) => (
          <Link key={href} href={href} className="navlink" aria-current={isTabActive(href)}>
            <span className="row"><Icon name={icon} size={20} />{t(key)}</span>
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
              {profile}
            </div>
          </div>
          {isWakingUp ? <div className="saved-banner" role="status">{t('common.waking_up')}</div> : null}
          {savedView ? <div className="saved-banner" role="status">{t('common.offline_saved')}</div> : null}
          {children}
        </main>
        <nav className="tabbar mobile-only" aria-label="Main navigation">
          {TABS_LEFT.map(renderTab)}
          <button type="button" className="tab-add" onClick={() => setAddOpen(true)} aria-label={t('nav.add')}>
            <Icon name="plus" size={26} />
          </button>
          {TABS_RIGHT.map(renderTab)}
        </nav>
      </div>
      {open ? <FamilySwitcher onClose={() => setOpen(false)} /> : null}
      <PwaInstallPrompt />
      {addOpen ? <AddSheet onClose={() => setAddOpen(false)} /> : null}
    </div>
  );
}
