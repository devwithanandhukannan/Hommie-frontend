'use client';
import Link from 'next/link';
import { useState } from 'react';
import { post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import ChatPanel from '@/components/ChatPanel';
import { Badge, Btn, Empty, ErrorNote, Field, Input, Sheet, Spinner, useAction } from '@/components/ui';
import { CATEGORY_LABEL, daysLabel, rupees, shortDate, toPaise } from '@/lib/format';

function AmountSheet({ inst, onClose, onDone }) {
  const { t } = useAuth();
  const [v, setV] = useState('');
  const [run, busy] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const amount = toPaise(v); if (!amount) return;
    if (await run(() => post(`/bill-instances/${inst.id}/amount`, { amount }), 'Amount saved')) { onDone(); onClose(); }
  };
  return (
    <Sheet title={`${inst.billTitle} · ${t('money.field_amount')}`} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <Field label={t('money.field_amount')}>{(id) => <Input id={id} inputMode="decimal" required value={v} onChange={(e) => setV(e.target.value)} placeholder="1840" />}</Field>
        <Btn type="submit" disabled={busy}>{t('btn.save')}</Btn>
      </form>
    </Sheet>
  );
}

export default function Dashboard() {
  const { t, family, user } = useAuth();
  const { data: d, error, loading, reload } = useData('/dashboard', { interval: 60000 });
  const [run] = useAction();
  const [amountFor, setAmountFor] = useState(null);
  if (loading && !d) return <Spinner />;
  if (error && !d) return <ErrorNote error={error} />;
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('greet.morning') : hour < 17 ? t('greet.afternoon') : t('greet.evening');
  const todo = d.myTasks.length + d.billsNeedingAmount.length + d.medicinesDueToday.length;

  const complete = (task) => run(async () => { await post(`/tasks/${task.id}/complete`, {}); reload(); }, 'Done');
  const give = (m) => run(async () => { await post(`/medicines/${m.medicineId}/logs`, { time: m.time, status: 'given' }); reload(); }, 'Recorded');

  return (
    <div className="row wrap" style={{ alignItems: 'flex-start', gap: 20 }}>
      <div className="grow col" style={{ minWidth: 300 }}>
        <div><h1>{greet}, {user.name.split(' ')[0]}</h1><p className="muted small" style={{ margin: '4px 0 0' }}>{family.name} · {todo ? `${todo} thing${todo === 1 ? '' : 's'} need you` : 'You are all caught up'}</p></div>

        <section className="card hero" aria-label="Wallet">
          <div className="row between"><span className="small">{t('dash.wallet')} · {family.name}</span><Link className="btn light sm" href="/money">{t('dash.settle_up')}</Link></div>
          <div style={{ fontSize: 32, fontWeight: 700, margin: '4px 0' }}>{rupees(d.wallet.net, { sign: true })}</div>
          <div className="row small" style={{ gap: 24 }}><span>{t('dash.owed_to_you')} <b>{rupees(d.wallet.owed)}</b></span><span>{t('dash.you_owe')} <b>{rupees(d.wallet.owe)}</b></span></div>
        </section>

        <section className="card" aria-label="To do">
          <div className="row between"><h2>{t('dash.todo')}</h2><Link href="/tasks" className="small bold">{t('dash.see_all')}</Link></div>
          {d.billsNeedingAmount.length + d.myTasks.length === 0 ? <Empty>{t('dash.no_tasks')}</Empty> : (
            <div className="list">
              {d.billsNeedingAmount.map((b) => (
                <div key={b.id} className="item"><div className="grow"><div className="bold">Enter {b.billTitle} amount</div><div className="small muted">Due {shortDate(b.dueDate)} · {daysLabel(b.daysLeft)}</div></div><Badge tone="warn">{t('dash.amount_needed')}</Badge><Btn size="sm" onClick={() => setAmountFor(b)}>{t('btn.add')}</Btn></div>
              ))}
              {d.myTasks.filter((x) => x.kind !== 'bill').map((x) => (
                <div key={x.id} className="item">
                  <button type="button" className="circle" aria-label={`Mark "${x.title}" done`} onClick={() => complete(x)}><span /></button>
                  <div className="grow"><div className="bold">{x.title}</div><div className="small muted">{x.dueDate ? `Due ${shortDate(x.dueDate)}` : 'No due date'}</div></div>
                  <Badge>{x.kind === 'chore' ? t('tasks.chore') : t('tasks.type_task')}</Badge>
                </div>
              ))}
              {d.myTasks.filter((x) => x.kind === 'bill' && !d.billsNeedingAmount.some((b) => b.taskId === x.id)).map((x) => (
                <div key={x.id} className="item"><div className="grow"><div className="bold">{x.title}</div><div className="small muted">{x.dueDate ? `Due ${shortDate(x.dueDate)}` : ''}</div></div><Link className="btn sm" href="/bills">{t('dash.open')}</Link></div>
              ))}
            </div>
          )}
          {d.unclaimedTasks ? <p className="small muted" style={{ marginBottom: 0 }}><Link href="/tasks">{d.unclaimedTasks} {t('dash.unassigned')}</Link></p> : null}
        </section>

        {d.medicinesDueToday.length ? (
          <section className="card" aria-label="Medicine"><h2>{t('dash.medicine')}</h2><div className="list">
            {d.medicinesDueToday.map((m) => (
              <div key={`${m.medicineId}${m.time}`} className="item"><div className="grow"><div className="bold">{m.forMember?.displayName} · {m.name}</div><div className="small muted">{m.time}{m.dosage ? ` · ${m.dosage}` : ''}</div></div>{m.status === 'missed' ? <Badge tone="danger">Missed</Badge> : null}<Btn size="sm" onClick={() => give(m)}>{t('med.given')}</Btn></div>
            ))}</div></section>
        ) : null}

        <section className="card" aria-label="Coming up"><div className="row between"><h2>{t('dash.coming')}</h2><div className="row" style={{ gap: 12 }}><Link href="/calendar" className="small bold">{t('nav.calendar')} ›</Link><Link href="/bills" className="small bold">{t('nav.bills')}</Link></div></div>
          {d.upcomingBills.length + d.upcomingEmi.length + d.specialDatesSoon.length === 0 ? <Empty>{t('dash.no_coming')}</Empty> : (
            <div className="list">
              {d.upcomingBills.map((b) => (
                <div key={b.id} className="item"><div className="grow"><div className="bold">{b.billTitle}</div><div className="small muted">{t('cat.' + b.category) || CATEGORY_LABEL[b.category]} · {shortDate(b.dueDate)} ({daysLabel(b.daysLeft)}){b.amount ? ` · ${rupees(b.amount)}` : ''}</div></div>{b.overdue ? <Badge tone="danger">Overdue</Badge> : <Badge tone={b.status === 'awaiting_amount' ? 'warn' : ''}>{b.status === 'awaiting_amount' ? t('dash.amount_needed') : t('bills.to_pay')}</Badge>}</div>
              ))}
              {d.upcomingEmi.map((l) => (<div key={l.id} className="item"><div className="grow"><div className="bold">{l.lender} EMI</div><div className="small muted">{shortDate(l.nextEmiDate)} · {rupees(l.emiAmount)} · private</div></div></div>))}
              {d.specialDatesSoon.map((s) => (<div key={s.id} className="item"><div className="grow"><div className="bold">{s.title}</div><div className="small muted">{shortDate(s.nextDate)} ({daysLabel(s.daysAway)})</div></div><Badge tone="info">{s.kind}</Badge></div>))}
            </div>
          )}
        </section>

        {d.expiringDocuments.length ? (
          <section className="card"><div className="row between"><h2>{t('dash.docs')}</h2><Link href="/documents" className="small bold">{t('docs.title')}</Link></div><div className="list">
            {d.expiringDocuments.map((x) => (<div key={x.id} className="item"><div className="grow bold">{x.title}</div><Badge tone={x.expiresInDays < 8 ? 'danger' : 'warn'}>{x.expiresInDays < 0 ? 'Expired' : `in ${x.expiresInDays} days`}</Badge></div>))}</div></section>
        ) : null}

        <div className="grid-auto">
          <section className="card"><div className="row between"><h2>{t('dash.grocery')}</h2><Link href="/grocery" className="small bold">{t('dash.open')}</Link></div>
            <p style={{ margin: 0 }}><b>{d.grocery.needed}</b> {d.grocery.needed === 1 ? t('dash.item_needed') : t('dash.items_needed')}</p>
            {d.grocery.likelyLow.length ? <p className="small muted" style={{ marginBottom: 0 }}>{t('dash.running_low')}: {d.grocery.likelyLow.map((g) => g.name).join(', ')}</p> : null}
          </section>
          <section className="card"><div className="row between"><h2>{t('dash.meals')}</h2><Link href="/meals" className="small bold">{t('dash.plan')}</Link></div>
            {d.todayMeals.length === 0 ? <p className="muted small" style={{ margin: 0 }}>{t('dash.no_meals')}</p> : ['morning', 'noon', 'night'].map((s) => { const m = d.todayMeals.find((x) => x.slot === s); return m ? <p key={s} style={{ margin: '0 0 4px' }}><b style={{ textTransform: 'capitalize' }}>{s}</b>: {m.items.join(', ') || '—'}</p> : null; })}
          </section>
        </div>
      </div>
      <aside className="chat-aside card" style={{ width: 360, flex: 'none' }} aria-label="Family chat"><h2 style={{ marginBottom: 4 }}>{t('nav.chat')} {d.unreadChat ? <Badge tone="danger">{d.unreadChat} {t('notif.new')}</Badge> : null}</h2><ChatPanel compact /></aside>
      {amountFor ? <AmountSheet inst={amountFor} onClose={() => setAmountFor(null)} onDone={reload} /> : null}
    </div>
  );
}
