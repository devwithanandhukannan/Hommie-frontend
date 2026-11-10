'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { post } from '@/lib/api';
import { useAuth, useData, notifyChanged } from '@/lib/auth';
import { Icon, Btn, Sheet, Skeleton, CardListSkeleton, ErrorNote, useAction } from '@/components/ui';
import { rupees, toPaise, shortDate, todayStr } from '@/lib/format';
import { requestNotifications } from '@/lib/permissions';

const LOCALES = { en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', ml: 'ml-IN' };
const minutes = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
const hhmmNow = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const shift = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmt = (s, lang, opts) => new Date(`${s}T00:00:00Z`).toLocaleDateString(LOCALES[lang] || 'en-IN', { timeZone: 'UTC', ...opts });

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

/** A row: small tags, a light title, one big round action. */
function TaskRow({ chips = [], title, action, link, done }) {
  return (
    <div className={`trow ${done ? 'is-done' : ''}`}>
      <div className="trow-main">
        {chips.length ? <div className="trow-chips">{chips.map((c, i) => <span key={i} className={`chip ${c.tone || ''}`}>{c.label}</span>)}</div> : null}
        <div className="trow-title">{title}</div>
        {link ? <button type="button" className="trow-link" onClick={link.onClick}>{link.label}</button> : null}
      </div>
      {done ? <span className="round-act ok" aria-hidden="true"><Icon name="check" size={26} /></span> : action ? <button type="button" className="round-act" onClick={action.onClick}>{action.label}</button> : null}
    </div>
  );
}

function NotificationAsk({ t }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (!('Notification' in window) || Notification.permission !== 'default') return;
      if (Date.now() - Number(localStorage.getItem('fh_notif_ask_at') || 0) > 7 * 864e5) setShow(true);
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

function DayTimeline({ day, today, t }) {
  const { data, loading } = useData(`/calendar?from=${day}&to=${day}`);
  if (loading && !data) {
    return (
      <div className="col" style={{ gap: 10, marginTop: 14 }} role="status" aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map((i) => <Skeleton key={i} width={i === 1 ? '76%' : '90%'} height={44} radius={14} />)}
      </div>
    );
  }
  const timeOf = (e) => { const m = /(\d{1,2}:\d{2})/.exec(`${e.title} ${e.subtitle || ''}`); return m ? m[1].padStart(5, '0') : null; };
  const slot = { Breakfast: '08:00', Lunch: '13:00', Dinner: '20:00' };
  const events = (data?.byDate?.[day] || []).map((e) => ({ ...e, time: timeOf(e) || (e.type === 'meal' ? slot[e.subtitle] : null) }))
    .sort((a, b) => String(a.time || '00:00').localeCompare(String(b.time || '00:00')));
  if (!events.length) return <p className="today-sentence" style={{ marginTop: 22 }}>{t('day.empty')}</p>;
  return (
    <div className="tline">
      {events.map((e, i) => (
        <div key={`${e.type}-${e.id}-${i}`} className={`tl-item ${i === 0 && day > today ? 'next' : ''}`}>
          <div className="tl-row"><span className="tl-title">{e.title.replace(/\s*\(\d{1,2}:\d{2}\)/, '')}</span>{e.time ? <span className="tl-time">{e.time}</span> : null}</div>
          {(() => { const sub = [(e.subtitle || '').replace(/\s*·?\s*\d{1,2}:\d{2}/, '').replace(/^\s*·\s*/, '').trim(), e.person?.displayName].filter(Boolean).join(' · '); return sub ? <div className="tl-sub">{sub}</div> : null; })()}
        </div>
      ))}
    </div>
  );
}

export default function Today() {
  const { t, family, user, lang } = useAuth();
  const { data: d, error, loading, reload } = useData('/dashboard', { interval: 60000 });
  const { data: doneTasks } = useData('/tasks?scope=done', { interval: 60000 });
  const [run] = useAction();
  const [amountFor, setAmountFor] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const tz = family?.timezone || undefined;
  const today = todayStr(tz);
  const [sel, setSel] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const day = sel || today;
  const mid = anchor || today;
  const days = useMemo(() => [-3, -2, -1, 0, 1, 2, 3].map((n) => shift(mid, n)), [mid]);

  if (loading && !d) {
    return (
      <div className="today-grid" role="status" aria-busy="true" aria-label="Loading">
        <div className="today-main">
          <div className="col" style={{ gap: 10, marginBottom: 16 }}>
            <Skeleton width={220} height={32} radius={10} />
            <Skeleton width={170} height={14} />
          </div>
          <div className="skel-week" style={{ marginBottom: 16 }}>
            {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} width="100%" height={56} radius={16} />)}
          </div>
          <Skeleton width="100%" height={92} radius={24} style={{ marginBottom: 16 }} />
          <CardListSkeleton rows={3} />
        </div>
        <aside className="today-side" aria-hidden="true">
          <CardListSkeleton rows={3} header />
        </aside>
      </div>
    );
  }
  if (error && !d) return <ErrorNote error={error} />;

  const me = family?.myMembershipId;
  const nowMin = minutes(hhmmNow());
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('greet.morning') : hour < 17 ? t('greet.afternoon') : t('greet.evening');
  const first = (user?.name || '').split(' ')[0];
  const act = (fn) => run(async () => { await fn(); notifyChanged(); reload(); });
  const dayOf = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Asia/Kolkata' }).format(new Date(iso));

  const pending = [];
  const soon = [];
  const done = [];

  for (const m of d.medicinesDueToday || []) {
    const mine = m.forMember?.membershipId === me;
    const label = `${m.name}${m.dosage ? ` · ${m.dosage}` : ''}`;
    const who = mine ? [] : [{ label: m.forMember?.displayName || '' }];
    if (m.status === 'given') { done.push({ key: `med-${m.medicineId}-${m.time}`, chips: [{ label: t('today.done'), tone: 'ok' }, { label: m.time }], title: label }); continue; }
    if (m.status === 'skipped') continue;
    const missed = m.status === 'missed';
    pending.push({
      key: `med-${m.medicineId}-${m.time}`, now: missed || minutes(m.time) <= nowMin + 30,
      chips: [...(missed ? [{ label: t('row.missed'), tone: 'warn' }] : []), { label: m.time }, ...who], title: label,
      action: { label: t('today.given'), onClick: () => act(() => post(`/medicines/${m.medicineId}/logs`, { time: m.time, status: 'given' })) },
      link: { label: t('today.skip'), onClick: () => act(() => post(`/medicines/${m.medicineId}/logs`, { time: m.time, status: 'skipped' })) },
    });
  }

  const seen = new Set();
  for (const i of [...(d.billsNeedingAmount || []), ...(d.upcomingBills || [])]) {
    const dedupeKey = `${i.billId || i.id}:${i.dueDate}`; // one row per bill and date, even if the database ever holds twins
    if (seen.has(dedupeKey) || i.status === 'paid') continue;
    seen.add(dedupeKey);
    const needsAmount = i.status === 'awaiting_amount' || i.amount == null;
    if (i.payer?.membershipId !== me) { soon.push({ key: `bill-${i.id}`, href: '/money?tab=bills', title: i.billTitle, sub: shortDate(i.dueDate) }); continue; }
    pending.push({
      key: `bill-${i.id}`, now: i.overdue || i.daysLeft <= 2 || needsAmount,
      chips: [...(i.overdue ? [{ label: t('row.overdue'), tone: 'warn' }] : []), { label: shortDate(i.dueDate) }, ...(needsAmount ? [{ label: t('row.amount') }] : [{ label: rupees(i.amount) }])],
      title: i.billTitle,
      action: needsAmount ? { label: t('today.enter'), onClick: () => setAmountFor(i) } : { label: t('today.pay'), onClick: () => act(() => post(`/bill-instances/${i.id}/pay`, {})) },
    });
  }

  for (const task of (d.myTasks || []).filter((x) => x.kind !== 'bill')) {
    const overdue = task.dueDate && task.dueDate < today;
    pending.push({
      key: `task-${task.id}`, now: overdue || task.dueDate === today,
      chips: [...(overdue ? [{ label: t('row.overdue'), tone: 'warn' }] : []), ...(task.dueDate ? [{ label: shortDate(task.dueDate) }] : [])],
      title: task.title, action: { label: t('today.done'), onClick: () => act(() => post(`/tasks/${task.id}/complete`, {})) },
    });
  }
  for (const task of (doneTasks || []).filter((x) => x.completedAt && dayOf(x.completedAt) === today && x.completedBy?.membershipId === me)) {
    done.push({ key: `done-${task.id}`, chips: [{ label: t('today.done'), tone: 'ok' }], title: task.title });
  }
  for (const s of (d.specialDatesSoon || []).filter((x) => x.daysAway <= 14)) soon.push({ key: `sd-${s.id}`, href: '/special-days', title: s.title, sub: s.daysAway === 0 ? t('today.now') : shortDate(s.nextDate) });
  for (const doc of d.expiringDocuments || []) soon.push({ key: `doc-${doc.id}`, href: '/documents', title: doc.title, sub: shortDate(doc.expiryDate) });

  // Urgent first, then the rest of today.
  pending.sort((a, b) => Number(b.now) - Number(a.now));
  const total = pending.length + done.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  const filled = total ? Math.round((done.length / total) * 10) : 0;
  const LIMIT = 4;
  const shown = expanded ? pending : pending.slice(0, LIMIT);
  const hidden = pending.length - shown.length;
  const urgent = pending.filter((r) => r.now).length;
  const sentence = urgent === 0 ? t('today.calm') : urgent === 1 ? t('today.one') : `${urgent} ${t('today.many')}`;

  const meals = (d.todayMeals || []).filter((m) => m.items?.length);
  const net = d.wallet?.net || 0;
  const low = d.grocery?.likelyLow || [];
  const hasHome = Boolean(meals.length || d.grocery?.needed || low.length || net !== 0);
  const hasSide = Boolean(soon.length || hasHome);

  return (
    <div className="today-page">
      <h1 className="today-hello">{greet}{first ? `, ${first}` : ''}</h1>
      <p className="today-sentence">{sentence}</p>

      <div className="wk-head">
        <button type="button" className="wk-arrow" aria-label="Previous week" onClick={() => setAnchor(shift(mid, -7))}>‹</button>
        <b>{fmt(day, lang, { month: 'long' })}</b>
        <button type="button" className="wk-arrow" aria-label="Next week" onClick={() => setAnchor(shift(mid, 7))}>›</button>
      </div>
      <div className="wk-strip" role="tablist" aria-label="Week">
        {days.map((s, i) => (
          <button key={s} type="button" role="tab" aria-selected={s === day} className={`wk-day ${s === day ? 'on' : ''} ${s === today ? 'today' : ''} ${Math.abs(i - 3) >= 3 ? 'far' : ''}`} onClick={() => setSel(s === today ? null : s)}>
            <small>{fmt(s, lang, { weekday: 'short' })}</small>
            <span>{Number(s.slice(8))}</span>
            <i />
          </button>
        ))}
      </div>

      {day !== today ? <DayTimeline day={day} today={today} t={t} /> : (
        <div className={hasSide ? 'today-grid' : 'today-grid is-single'}>
          <div className="today-primary">
            <section className="goal" aria-label={t('goal.title')}>
              <div className="goal-top"><span>{t('goal.title')}</span><span><b>{done.length}/{total}</b> {t('goal.completed')}</span></div>
              <div className="goal-body">
                <div className="goal-pct">{total ? pct : '—'}{total ? <small>%</small> : null}</div>
                <div className="dots" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < filled ? 'on' : ''} />)}</div>
              </div>
            </section>

            {shown.length || done.length ? (
              <div className="trows">
                {shown.map(({ key, now, ...r }) => <TaskRow key={key} {...r} />)}
                {done.slice(0, 3).map(({ key, ...r }) => <TaskRow key={key} done {...r} />)}
              </div>
            ) : null}
            {hidden > 0 ? <button type="button" className="link-btn" onClick={() => setExpanded(true)}>{t('today.more')} ({hidden})</button> : null}
            {expanded && pending.length > LIMIT ? <button type="button" className="link-btn" onClick={() => setExpanded(false)}>{t('today.less')}</button> : null}
            {!hasSide ? <div style={{ marginTop: 18 }}><NotificationAsk t={t} /></div> : null}
          </div>

          {hasSide ? (
            <div className="today-side">
              {soon.length ? (
                <>
                  <h2 className="today-title">{t('today.soon')}</h2>
                  <div className="mini-lines">
                    {soon.slice(0, 4).map((s) => <Link key={s.key} href={s.href} className="mini-line"><span>{s.title}</span><span className="small muted">{s.sub}</span></Link>)}
                  </div>
                </>
              ) : null}

              {hasHome ? (
                <>
                  <h2 className="today-title">{family?.name}</h2>
                  <div className="mini-lines">
                    {meals.length ? <Link href="/planner?tab=meals" className="mini-line"><span>{meals.map((m) => m.items.join(', ')).join(' · ')}</span><Icon name="meals" size={20} /></Link> : null}
                    {d.grocery?.needed ? <Link href="/planner?tab=grocery" className="mini-line"><span>{d.grocery.needed} {t('today.grocery_n')}</span><Icon name="cart" size={20} /></Link> : null}
                    {low.length ? (
                      <div className="mini-line"><span>{t('today.low')}: {low.slice(0, 3).map((g) => g.name).join(', ')}</span><button type="button" className="chip" style={{ border: 0, cursor: 'pointer' }} onClick={() => low.slice(0, 3).forEach((g) => act(() => post(`/grocery/${g.id}/need`, {})))}>{t('today.restock')}</button></div>
                    ) : null}
                    {net !== 0 ? <Link href="/money?tab=wallet" className="mini-line"><span>{net < 0 ? t('today.owe') : t('today.owed')} <b>{rupees(Math.abs(net))}</b></span><span className="small muted">{t('dash.settle_up')}</span></Link> : null}
                  </div>
                </>
              ) : null}
              <div style={{ marginTop: 18 }}><NotificationAsk t={t} /></div>
            </div>
          ) : null}
        </div>
      )}

      {amountFor ? <AmountSheet inst={amountFor} onClose={() => { setAmountFor(null); reload(); }} /> : null}
    </div>
  );
}
