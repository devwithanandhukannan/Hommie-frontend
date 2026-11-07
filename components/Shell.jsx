'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { useAuth, useData } from '@/lib/auth';
import { Icon, Sheet, Btn, Badge } from '@/components/ui';
import { applyTheme, getSavedTheme } from '@/lib/theme';
import PermissionsPrompt from '@/components/PermissionsPrompt';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import QuickActionFab from '@/components/QuickActionFab';
import AiAssistantModal from '@/components/AiAssistantModal';

const MAIN_NAV = [
  ['/dashboard', 'Today'],
  ['/planner', 'Plan'],
  ['/money', 'Money'],
  ['/chat', 'Chat'],
];

const MORE_NAV = [
  ['/medicine', 'Medicine'],
  ['/documents', 'Documents'],
  ['/special-days', 'Special days'],
  ['/family', 'Family'],
];

const MOBILE_TABS = [
  ['/dashboard', 'Today'],
  ['/planner', 'Plan'],
  ['/money', 'Money'],
  ['/chat', 'Chat'],
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
  const [voiceOpen, setVoiceOpen] = useState(false);
  const notes = useData('/me/notifications', { interval: 60000 });
  const unread = notes.data?.unread || 0;
  const chatUnread = families?.find((f) => f.id === familyId)?.unreadChat || 0;

  const isTabActive = (href) => {
    if (href === '/dashboard') return path === '/dashboard' || path === '/';
    if (href === '/chat') return path === '/chat';
    if (href === '/planner') {
      return ['/planner', '/tasks', '/grocery', '/meals', '/recipes', '/calendar'].some((p) => path === p || path.startsWith(`${p}/`));
    }
    if (href === '/money') {
      return ['/money', '/bills'].some((p) => path === p || path.startsWith(`${p}/`));
    }
    if (href === '/medicine') return path === '/medicine' || path.startsWith('/medicine/');
    if (href === '/documents') return path === '/documents' || path.startsWith('/documents/');
    if (href === '/special-days') return path === '/special-days' || path.startsWith('/special-days/');
    if (href === '/family') return path === '/family' || path === '/settings';
    return path === href || path.startsWith(`${href}/`);
  };

  const isSettingsActive = path === '/settings' || path === '/family';

  // Format today's date for mobile topbar (e.g. "SAT · 7 NOV")
  const dateFormatted = useMemo(() => {
    const now = new Date();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${days[now.getDay()]} · ${now.getDate()} ${months[now.getMonth()]}`;
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

  return (
    <div className="shell">
      {/* Desktop Editorial Left Sidebar */}
      <aside className="side" aria-label="Main navigation">
        <Link href="/dashboard" className="brand-title">
          Hommi
        </Link>

        <nav className="col" style={{ gap: 4 }}>
          {MAIN_NAV.map(([href, label]) => {
            const active = isTabActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="navlink"
                aria-current={active ? 'page' : undefined}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {active ? <span className="active-dot" /> : <span className="active-dot-placeholder" />}
                  <span>{label}</span>
                </span>
                {href === '/chat' && chatUnread ? (
                  <span className="badge danger" style={{ marginLeft: 'auto', padding: '1px 6px', fontSize: 10 }}>
                    {chatUnread}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="section-label" style={{ margin: '28px 0 8px 13px' }}>
          MORE
        </div>

        <nav className="col" style={{ gap: 4 }}>
          {MORE_NAV.map(([href, label]) => {
            const active = isTabActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="navlink"
                aria-current={active ? 'page' : undefined}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {active ? <span className="active-dot" /> : <span className="active-dot-placeholder" />}
                  <span>{label}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {/* User Account / Settings at Bottom */}
        <Link
          href="/settings"
          className="row"
          style={{
            marginTop: 'auto',
            padding: '10px 0',
            color: 'var(--text)',
            textDecoration: 'none',
            gap: 10,
            alignItems: 'center',
          }}
          title="Account & Settings"
          aria-current={isSettingsActive ? 'page' : undefined}
        >
          {isSettingsActive ? <span className="active-dot" /> : <span className="active-dot-placeholder" />}
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
              flexShrink: 0,
            }}
          >
            {(user?.name || 'A')[0].toUpperCase()}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              maxWidth: 130,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.name || 'Anandhu'}
          </span>
        </Link>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <main className={`main ${path === '/chat' ? 'main-chat' : ''}`}>
          {/* Mobile Top Header (SAT · 7 NOV + Avatar) */}
          <div className="topbar mobile-only">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              {dateFormatted}
            </div>
            <div className="row" style={{ gap: 10 }}>
              {families.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--muted)',
                  }}
                >
                  {family?.name}
                </button>
              ) : null}
              <Link href="/more" style={{ textDecoration: 'none' }} aria-label="My Profile">
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--brand)',
                    color: 'var(--on-brand)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {(user?.name || 'A')[0].toUpperCase()}
                </span>
              </Link>
            </div>
          </div>

          {children}
        </main>

        {/* Mobile Editorial Bottom Bar */}
        <nav className="tabbar mobile-only" aria-label="Main navigation">
          {MOBILE_TABS.map(([href, label]) => {
            const isCurrent = isTabActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`tab ${isCurrent ? 'active' : ''}`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {isCurrent ? <span className="active-dot" style={{ margin: 0, width: 4, height: 4 }} /> : null}
                <span>{label}</span>
                {href === '/chat' && chatUnread ? <span className="tab-unread-dot" /> : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {open ? <FamilySwitcher onClose={() => setOpen(false)} /> : null}
      <PermissionsPrompt />
      <PwaInstallPrompt />
      <QuickActionFab />
      {voiceOpen ? <AiAssistantModal onClose={() => setVoiceOpen(false)} onDone={() => setVoiceOpen(false)} /> : null}
    </div>
  );
}
