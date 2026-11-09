'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { post } from '@/lib/api';
import { useAuth, useData, notifyChanged } from '@/lib/auth';
import { Icon, Input, Field, Btn, Sheet, Spinner, ErrorNote, useAction } from '@/components/ui';
import { rupees, toPaise, shortDate, todayStr } from '@/lib/format';
import { requestNotifications } from '@/lib/permissions';

const hhmmNow = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const minutes = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };

function AmountSheet({ inst, onClose }) {
  const { t } = useAuth();
  const [v, setV] = useState('');
  const [run, busy] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const amount = toPaise(v);
    if (!amount) return;
    if (await run(() => post(`/bill-instances/${inst.id}/amount`, { amount }))) { notifyChanged(); onClose(); }
  };
  return (
    <Sheet title={`${inst.billTitle} · ${t('money.field_amount')}`} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <div className="amount-field"><span>₹</span><input autoFocus required inputMode="decimal" aria-label={t('money.field_amount')} placeholder="0" value={v} onChange={(e) => setV(e.target.value)} /></div>
        <Btn type="submit" disabled={busy || !toPaise(v)}>{t('btn.save')}</Btn>
      </form>
    </Sheet>
  );
}

/** One row of the stream: a title, a quiet subtitle and at most one primary action. */
function Moment({ icon, title, sub, urgent, href, action, second, check }) {
  const body = (
    <>
      <span className="moment-icon"><Icon name={icon} size={20} /></span>
      <span className="moment-body"><div className="moment-title">{title}</div>{sub ? <div className="moment-sub">{sub}</div> : null}</span>
    </>
  );
  return (
    <div className={`moment ${urgent ? 'urgent' : ''}`}>
      {check ? <button type="button" className="moment-check" aria-label={check.label} onClick={check.onClick}><Icon name="check" size={18} /></button> : null}
      {href ? <Link href={href} style={{ display: 'contents', color: 'inherit', textDecoration: 'none' }}>{body}</Link> : body}
      {second ? <button type="button" className="moment-act ghost" onClick={second.onClick}>{second.label}</button> : null}
      {action ? <button type="button" className="moment-act" onClick={action.onClick}>{action.label}</button> : null}
    </div>
  );
}

function NotificationAsk({ t }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!('Notification' in window) || Notification.permission !== 'default') return;
      const at = Number(localStorage.getItem('fh_notif_ask_at') || 0);
      if (Date.now() - at > 7 * 864e5) setShow(true);
    } catch { /* storage unavailable: just don't ask */ }
  }, []);
  if (!show) return null;
  const later = () => { try { localStorage.setItem('fh_notif_ask_at', String(Date.now())); } catch {} setShow(false); };
  return (
    <div className="today-ask">
      <Icon name="bell" size={22} />
      <p><b>{t('today.notif_title')}</b><br /><span className="muted">{t('today.notif_sub')}</span></p>
      <button type="button" className="moment-act ghost" onClick={later}>{t('today.notif_no')}</button>
      <button type="button" className="moment-act" onClick={async () => { await requestNotifications().catch(() => {}); later(); }}>{t('today.notif_yes')}</button>
    </div>
  );
}

export default function Today() {
  const { t, family, user } = useAuth();
  const { data: d, error, loading, reload } = useData('/dashboard', { interval: 60000 });
  const [run] = useAction();
  const [amountFor, setAmountFor] = useState(null);
  const [expanded, setExpanded] = useState(false);
  if (loading && !d) return <Spinner />;
  if (error && !d) return <ErrorNote error={error} />;

  const me = family?.myMembershipId;
  const today = todayStr(family?.timezone || undefined);
  const nowMin = minutes(hhmmNow());
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('greet.morning') : hour < 17 ? t('greet.afternoon') : t('greet.evening');
  const first = (user?.name || '').split(' ')[0];

  const act = (fn) => run(async () => { await fn(); notifyChanged(); reload(); });
  const complete = (task) => act(() => post(`/tasks/${task.id}/complete`, {}));
  const logDose = (m, status) => act(() => post(`/medicines/${m.medicineId}/logs`, { time: m.time, status }));
  const payBill = (i) => act(() => post(`/bill-instances/${i.id}/pay`, {}));
  const restock = (g) => act(() => post(`/grocery/${g.id}/need`, {}));

  const now = [];
  const later = [];
  const soon = [];

  // Medicine: doses that were missed or are due within the next half hour need you now; the rest wait.
  for (const m of d.medicinesDueToday || []) {
    if (m.status === 'given' || m.status === 'skipped') continue;
    const mine = m.forMember?.membershipId === me;
    const row = {
      key: `med-${m.medicineId}-${m.time}`, icon: 'med', urgent: m.status === 'missed',
      title: `${m.name}${m.dosage ? ` · ${m.dosage}` : ''}`,
      sub: `${m.time}${mine ? '' : ` · ${m.forMember?.displayName || ''}`}${m.status === 'missed' ? ' · ⏰' : ''}`,
      action: { label: t('today.given'), onClick: () => logDose(m, 'given') },
      second: { label: t('today.skip'), onClick: () => logDose(m, 'skipped') },
    };
    (m.status === 'missed' || minutes(m.time) <= nowMin + 30 ? now : later).push(row);
  }

  // Bills that are mine to enter or pay.
  const billSeen = new Set();
  for (const i of [...(d.billsNeedingAmount || []), ...(d.upcomingBills || [])]) {
    if (billSeen.has(i.id) || i.status === 'paid') continue;
    billSeen.add(i.id);
    if (i.payer?.membershipId !== me) continue;
    const needsAmount = i.status === 'awaiting_amount' || i.amount == null;
    const dueSoon = i.overdue || i.daysLeft <= 2;
    const row = {
      key: `bill-${i.id}`, icon: 'bills', urgent: i.overdue,
      title: needsAmount ? `${i.billTitle}` : `${i.billTitle} · ${rupees(i.amount)}`,
      sub: i.overdue ? `${shortDate(i.dueDate)} · ⏰` : shortDate(i.dueDate),
      action: needsAmount ? { label: t('today.enter'), onClick: () => setAmountFor(i) } : { label: t('today.pay'), onClick: () => payBill(i) },
    };
    (dueSoon || needsAmount ? now : soon).push(row);
  }

  // My tasks (bill tasks are covered by the bill rows above, so they are never counted twice).
  for (const task of (d.myTasks || []).filter((x) => x.kind !== 'bill')) {
    const overdue = task.dueDate && task.dueDate < today;
    const row = {
      key: `task-${task.id}`, icon: 'tasks', urgent: overdue, title: task.title,
      sub: task.dueDate ? (overdue ? `${shortDate(task.dueDate)} · ⏰` : shortDate(task.dueDate)) : '',
      check: { label: t('today.done'), onClick: () => complete(task) },
    };
    (overdue || task.dueDate === today ? now : later).push(row);
  }

  for (const s of (d.specialDatesSoon || []).filter((x) => x.daysAway <= 14)) {
    soon.push({ key: `sd-${s.id}`, icon: 'days', title: s.title, sub: s.daysAway === 0 ? t('today.now') : shortDate(s.nextDate), href: '/special-days' });
  }
  for (const doc of d.expiringDocuments || []) soon.push({ key: `doc-${doc.id}`, icon: 'docs', title: doc.title, sub: shortDate(doc.expiryDate), href: '/documents' });

  const total = now.length + later.length + soon.length;
  const LIMIT = 5;
  const sentence = now.length === 0 ? t('today.calm') : now.length === 1 ? t('today.one') : `${now.length} ${t('today.many')}`;

  // Respect the limit across groups, in priority order, unless expanded.
  let budget = expanded ? Infinity : LIMIT;
  const slice = (list) => { const out = list.slice(0, Math.max(0, budget)); budget -= out.length; return out; };
  const shownNow = slice(now); const shownLater = slice(later); const shownSoon = slice(soon);
  const hidden = total - shownNow.length - shownLater.length - shownSoon.length;

  const meals = (d.todayMeals || []).filter((m) => m.items?.length);
  const net = d.wallet?.net || 0;
  const low = d.grocery?.likelyLow || [];

  const group = (label, rows) => rows.length ? (
    <section>
      <h2 className="today-group">{label}</h2>
      <div className="moments">{rows.map(({ key, ...r }) => <Moment key={key} {...r} />)}</div>
    </section>
  ) : null;

  return (
    <div>
      <h1 className="today-hello">{greet}{first ? `, ${first}` : ''}</h1>
      <p className="today-sentence">{sentence}</p>

      {group(now.length ? t('today.now') : null, shownNow)}
      {group(t('today.later'), shownLater)}
      {group(t('today.soon'), shownSoon)}
      {hidden > 0 ? <button type="button" className="link-btn" onClick={() => setExpanded(true)}>{t('today.more')} ({hidden})</button> : null}
      {expanded && total > LIMIT ? <button type="button" className="link-btn" onClick={() => setExpanded(false)}>{t('today.less')}</button> : null}

      <h2 className="today-group">{family?.name}</h2>
      <div className="moments">
        {meals.length ? (
          <Link href="/planner?tab=meals" className="today-line"><span className="row" style={{ gap: 10 }}><Icon name="meals" size={20} /><span>{meals.map((m) => m.items.join(', ')).join(' · ')}</span></span></Link>
        ) : null}
        {d.grocery?.needed ? (
          <Link href="/planner?tab=grocery" className="today-line"><span className="row" style={{ gap: 10 }}><Icon name="cart" size={20} /><span>{d.grocery.needed} {t('today.grocery_n')}</span></span><Icon name="back" size={16} /></Link>
        ) : null}
        {low.length ? (
          <div className="today-line"><span>{t('today.low')}: {low.slice(0, 3).map((g) => g.name).join(', ')}</span><button type="button" className="moment-act ghost" onClick={() => low.slice(0, 3).forEach(restock)}>{t('today.restock')}</button></div>
        ) : null}
        {net !== 0 ? (
          <Link href="/money?tab=wallet" className="today-line"><span>{net < 0 ? t('today.owe') : t('today.owed')} <b>{rupees(Math.abs(net))}</b></span><span className="small muted">{t('dash.settle_up')}</span></Link>
        ) : null}
      </div>

      <div style={{ marginTop: 18 }}><NotificationAsk t={t} /></div>

      {amountFor ? <AmountSheet inst={amountFor} onClose={() => { setAmountFor(null); reload(); }} /> : null}
    </div>
  );
}
