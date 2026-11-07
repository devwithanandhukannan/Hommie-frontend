'use client';
import Link from 'next/link';
import { useState } from 'react';
import { post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import ChatPanel from '@/components/ChatPanel';
import AiAssistantModal from '@/components/AiAssistantModal';
import { Avatar, Badge, Btn, Empty, ErrorNote, Field, Icon, Input, Sheet, Spinner, useAction } from '@/components/ui';
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
  const { t, lang, family, user, members } = useAuth();
  const { data: d, error, loading, reload } = useData('/dashboard', { interval: 60000 });
  const [run] = useAction();
  const [amountFor, setAmountFor] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
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
        {/* Warm Caring Header */}
        <div>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em' }}>
                {greet}, {user.name.split(' ')[0]}
              </h1>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                {family.name} · {todo ? (lang === 'ml' ? `ഇന്ന് ${todo} കാര്യങ്ങൾ ചെയ്യാനുണ്ട്` : `${todo} thing${todo === 1 ? '' : 's'} need you today`) : (lang === 'ml' ? 'ഇന്നത്തെ കാര്യങ്ങളെല്ലാം പൂർത്തിയായി' : 'You are all caught up')}
              </p>
            </div>
            <button
              type="button"
              className="btn light sm"
              onClick={() => setAiOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '7px 14px', fontWeight: 600, color: 'var(--brand)', background: 'rgba(13, 71, 52, 0.08)', border: '1px solid rgba(13, 71, 52, 0.2)' }}
              title={lang === 'ml' ? 'എഐ വോയ്സ് അസിസ്റ്റന്റ്' : 'AI Voice Assistant'}
            >
              <Icon name="sparkles" size={15} />
              <span>{lang === 'ml' ? 'എഐ വോയ്സ്' : 'AI Voice'}</span>
            </button>
          </div>
        </div>

        {/* 1. TODAY'S ESSENTIALS: Medicine Due Today (First Priority for Family Care) */}
        {d.medicinesDueToday.length ? (
          <section className="card" aria-label="Medicine" style={{ borderLeft: '4px solid #10B981' }}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <Icon name="med" size={18} />
                <h2 style={{ margin: 0, fontSize: 16 }}>{lang === 'ml' ? 'കഴിക്കേണ്ട മരുന്നുകൾ' : t('dash.medicine')}</h2>
              </div>
              <Link href="/medicine" className="small bold">{t('dash.see_all')}</Link>
            </div>
            <div className="list">
              {d.medicinesDueToday.map((m) => (
                <div key={`${m.medicineId}${m.time}`} className="item">
                  <div className="grow">
                    <div className="bold">{m.forMember?.displayName} · {m.name}</div>
                    <div className="small muted">{m.time}{m.dosage ? ` · ${m.dosage}` : ''}</div>
                  </div>
                  {m.status === 'missed' ? <Badge tone="danger">{lang === 'ml' ? 'വിട്ടുപോയി' : 'Missed'}</Badge> : null}
                  <Btn size="sm" onClick={() => give(m)}>
                    {lang === 'ml' ? 'നൽകി' : t('med.given')}
                  </Btn>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* 2. TODAY'S MEALS: What's cooking today */}
        <section className="card" aria-label="Meals">
          <div className="row between" style={{ marginBottom: 10 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <Icon name="meals" size={18} />
              <h2 style={{ margin: 0, fontSize: 16 }}>{lang === 'ml' ? 'ഇന്നത്തെ ഭക്ഷണം' : t('dash.meals')}</h2>
            </div>
            <Link href="/planner?tab=meals" className="small bold">{lang === 'ml' ? 'പ്ലാൻ ചെയ്യുക ›' : t('dash.plan')}</Link>
          </div>
          {d.todayMeals.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>
              {lang === 'ml' ? 'ഇന്നത്തെ ഭക്ഷണ മെനു ചേർത്തിട്ടില്ല.' : t('dash.no_meals')}
            </p>
          ) : (
            <div className="row wrap" style={{ gap: 10 }}>
              {['morning', 'noon', 'night'].map((s) => {
                const m = d.todayMeals.find((x) => x.slot === s);
                const slotName = s === 'morning' ? (lang === 'ml' ? 'രാവിലെ' : 'Morning') : s === 'noon' ? (lang === 'ml' ? 'ഉച്ചയ്ക്ക്' : 'Noon') : (lang === 'ml' ? 'രാത്രി' : 'Night');
                return (
                  <div
                    key={s}
                    style={{
                      flex: 1,
                      minWidth: 120,
                      padding: '8px 12px',
                      background: 'var(--surface-2)',
                      borderRadius: 12,
                      border: '1px solid var(--line)',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                      {slotName}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2, wordBreak: 'break-word' }}>
                      {m?.items?.join(', ') || '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. TODAY'S TASKS: Chores & To-Dos */}
        <section className="card" aria-label="To do">
          <div className="row between" style={{ marginBottom: 10 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <Icon name="tasks" size={18} />
              <h2 style={{ margin: 0, fontSize: 16 }}>{lang === 'ml' ? 'ഇന്നത്തെ ജോലികൾ' : t('dash.todo')}</h2>
            </div>
            <Link href="/planner?tab=tasks" className="small bold">{t('dash.see_all')}</Link>
          </div>
          {d.billsNeedingAmount.length + d.myTasks.length === 0 ? (
            <Empty>{lang === 'ml' ? 'ഇന്ന് ചെയ്യേണ്ട ജോലികൾ ഒന്നുമില്ല' : t('dash.no_tasks')}</Empty>
          ) : (
            <div className="list">
              {d.billsNeedingAmount.map((b) => (
                <div key={b.id} className="item">
                  <div className="grow">
                    <div className="bold">{lang === 'ml' ? `${b.billTitle} തുക നൽകുക` : `Enter ${b.billTitle} amount`}</div>
                    <div className="small muted">Due {shortDate(b.dueDate)} · {daysLabel(b.daysLeft)}</div>
                  </div>
                  <Badge tone="warn">{t('dash.amount_needed')}</Badge>
                  <Btn size="sm" onClick={() => setAmountFor(b)}>{t('btn.add')}</Btn>
                </div>
              ))}
              {d.myTasks.filter((x) => x.kind !== 'bill').map((x) => (
                <div key={x.id} className="item">
                  <button type="button" className="circle" aria-label={`Mark "${x.title}" done`} onClick={() => complete(x)}>
                    <span />
                  </button>
                  <div className="grow">
                    <div className="bold">{x.title}</div>
                    <div className="small muted">{x.dueDate ? `Due ${shortDate(x.dueDate)}` : (lang === 'ml' ? 'തിയ്യതി നിശ്ചയിച്ചിട്ടില്ല' : 'No due date')}</div>
                  </div>
                  <Badge>{x.kind === 'chore' ? t('tasks.chore') : t('tasks.type_task')}</Badge>
                </div>
              ))}
            </div>
          )}
          {d.unclaimedTasks ? (
            <p className="small muted" style={{ margin: '8px 0 0' }}>
              <Link href="/planner?tab=tasks">{d.unclaimedTasks} {t('dash.unassigned')}</Link>
            </p>
          ) : null}
        </section>

        {/* 4. GROCERY PREVIEW: Items to buy */}
        <section className="card" aria-label="Grocery">
          <div className="row between" style={{ marginBottom: 10 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <Icon name="cart" size={18} />
              <h2 style={{ margin: 0, fontSize: 16 }}>{lang === 'ml' ? 'വാങ്ങേണ്ട പലചരക്കുകൾ' : t('dash.grocery')}</h2>
            </div>
            <Link href="/planner?tab=grocery" className="small bold">{lang === 'ml' ? 'ലിസ്റ്റ് തുറക്കുക ›' : t('dash.open')}</Link>
          </div>
          <div className="row between wrap" style={{ gap: 10, alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand)' }}>
                {d.grocery.needed}
              </span>
              <span style={{ marginLeft: 6, fontWeight: 500 }}>
                {d.grocery.needed === 1 ? (lang === 'ml' ? 'സാധനം വാങ്ങാനുണ്ട്' : t('dash.item_needed')) : (lang === 'ml' ? 'സാധനങ്ങൾ വാങ്ങാനുണ്ട്' : t('dash.items_needed'))}
              </span>
              {d.grocery.likelyLow.length ? (
                <div className="small muted" style={{ marginTop: 4 }}>
                  {lang === 'ml' ? 'തീരാറായവ' : t('dash.running_low')}: {d.grocery.likelyLow.map((g) => g.name).join(', ')}
                </div>
              ) : null}
            </div>
            <Link href="/planner?tab=grocery" className="btn light sm">
              + {lang === 'ml' ? 'ചേർക്കുക' : t('btn.add')}
            </Link>
          </div>
        </section>

        {/* 5. COMPACT FINANCES: Friendly Family Wallet & Upcoming Bills */}
        <section className="card" aria-label="Finances" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <Icon name="money" size={18} />
              <h2 style={{ margin: 0, fontSize: 16 }}>{lang === 'ml' ? 'കുടുംബ ചിലവുകൾ & ബില്ലുകൾ' : 'Family Finances'}</h2>
            </div>
            <Link href="/money" className="small bold">{lang === 'ml' ? 'വിശദാംശങ്ങൾ ›' : t('dash.settle_up')}</Link>
          </div>
          <div className="row wrap between" style={{ alignItems: 'center', gap: 14 }}>
            <div>
              <div className="small muted">{lang === 'ml' ? 'കയ്യിലുള്ള ബാലൻസ്' : 'Net Family Balance'}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: d.wallet.net >= 0 ? '#10B981' : '#EF4444' }}>
                {rupees(d.wallet.net, { sign: true })}
              </div>
            </div>
            {d.upcomingBills.length > 0 ? (
              <div style={{ textAlign: 'right' }}>
                <div className="small muted">{lang === 'ml' ? 'ഈ ആഴ്ച അടയ്ക്കാനുള്ള ബിൽ' : 'Next bill due'}</div>
                <div className="bold" style={{ fontSize: 14 }}>
                  {d.upcomingBills[0].billTitle} {d.upcomingBills[0].amount ? `· ${rupees(d.upcomingBills[0].amount)}` : ''}
                </div>
                <div className="tiny muted">Due {shortDate(d.upcomingBills[0].dueDate)} ({daysLabel(d.upcomingBills[0].daysLeft)})</div>
              </div>
            ) : null}
          </div>
        </section>

        {/* 6. QUICK ACTIONS GRID */}
        <section className="card" aria-label="Quick Actions">
          <div className="row between" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 16 }}>{t('dash.quick_actions')}</h2>
          </div>
          <div className="quick-actions-grid">
            <button
              type="button"
              className="quick-action-btn"
              onClick={() => setAiOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}
            >
              <span className="quick-action-icon" style={{ background: 'rgba(13, 71, 52, 0.15)', color: 'var(--brand)' }}>
                <Icon name="mic" size={20} />
              </span>
              <span>{lang === 'ml' ? 'എഐ വോയ്സ്' : 'AI Voice'}</span>
            </button>
            <Link href="/planner?tab=tasks" className="quick-action-btn">
              <span className="quick-action-icon" style={{ background: 'rgba(0, 113, 227, 0.12)', color: 'var(--info)' }}>
                <Icon name="tasks" size={20} />
              </span>
              <span>{t('nav.tasks')}</span>
            </Link>
            <Link href="/planner?tab=grocery" className="quick-action-btn">
              <span className="quick-action-icon" style={{ background: 'rgba(52, 199, 89, 0.12)', color: 'var(--ok)' }}>
                <Icon name="grocery" size={20} />
              </span>
              <span>{t('nav.grocery')}</span>
            </Link>
            <Link href="/planner?tab=meals" className="quick-action-btn">
              <span className="quick-action-icon" style={{ background: 'rgba(175, 82, 222, 0.12)', color: '#AF52DE' }}>
                <Icon name="meals" size={20} />
              </span>
              <span>{t('nav.meals')}</span>
            </Link>
            <Link href="/money" className="quick-action-btn">
              <span className="quick-action-icon" style={{ background: 'rgba(255, 149, 0, 0.12)', color: 'var(--warn)' }}>
                <Icon name="money" size={20} />
              </span>
              <span>{t('nav.money')}</span>
            </Link>
            <Link href="/medicine" className="quick-action-btn">
              <span className="quick-action-icon" style={{ background: 'rgba(255, 59, 48, 0.12)', color: 'var(--danger)' }}>
                <Icon name="med" size={20} />
              </span>
              <span>{t('nav.medicine')}</span>
            </Link>
          </div>
        </section>

        {/* 7. FAMILY MEMBERS */}
        {members && members.length > 0 ? (
          <section className="card" aria-label="Family members">
            <div className="row between" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 16 }}>{t('nav.family')} ({members.length})</h2>
              <Link href="/family" className="small bold">{t('dash.see_all')}</Link>
            </div>
            <div className="row wrap" style={{ gap: 12 }}>
              {members.map((m) => (
                <div key={m.id} className="row" style={{ padding: '8px 14px', background: 'var(--surface-2)', borderRadius: 14, gap: 10 }}>
                  <Avatar member={m} size={32} />
                  <div>
                    <div className="bold small">{m.displayName}</div>
                    <div className="tiny muted" style={{ textTransform: 'capitalize' }}>{m.relation || m.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <aside className="chat-aside card" style={{ width: 360, flex: 'none' }} aria-label="Family chat">
        <h2 style={{ marginBottom: 4 }}>{t('nav.chat')} {d.unreadChat ? <Badge tone="danger">{d.unreadChat} {t('notif.new')}</Badge> : null}</h2>
        <ChatPanel compact />
      </aside>
      {amountFor ? <AmountSheet inst={amountFor} onClose={() => setAmountFor(null)} onDone={reload} /> : null}
      {aiOpen ? (
        <AiAssistantModal
          onClose={() => setAiOpen(false)}
          onDone={() => {
            setAiOpen(false);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
