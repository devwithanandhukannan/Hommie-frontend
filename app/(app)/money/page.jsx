'use client';
import { useState } from 'react';
import { del, post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Badge, Btn, Empty, ErrorNote, Field, Input, MemberChecks, MemberSelect, PageHeader, Select, Sheet, Spinner, Tabs, useAction, useConfirm } from '@/components/ui';
import { CATEGORY_LABEL, rupees, shortDate, todayStr, toPaise } from '@/lib/format';

const ECATS = ['grocery', 'food', 'bills', 'rent', 'tax', 'emi', 'medical', 'transport', 'shopping', 'education', 'entertainment', 'household', 'other'];
const thisMonth = () => todayStr().slice(0, 7);
const shiftMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const monthLabel = (m, lang = 'en') => {
  const locale = lang === 'ml' ? 'ml-IN' : lang === 'ta' ? 'ta-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
  return new Date(`${m}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

function Bar({ value, max }) { return <div className="bar" aria-hidden="true"><span style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} /></div>; }

/* ---------- Expenses + monthly report ---------- */
function ExpenseForm({ onClose, onDone }) {
  const { family, t } = useAuth();
  const all = family.members.map((m) => m.membershipId);
  const [f, setF] = useState({ amount: '', category: 'grocery', date: todayStr(), note: '', paidById: family.myMembershipId, among: all });
  const [run, busy] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const amount = toPaise(f.amount); if (!amount || !f.among.length) return;
    const body = { amount, category: f.category, date: f.date, paidById: f.paidById, equalAmong: f.among };
    if (f.note.trim()) body.note = f.note.trim();
    if (await run(() => post('/expenses', body), 'Expense added')) { onDone(); onClose(); }
  };
  return (
    <Sheet title={t('money.add_expense')} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <div className="row wrap">
          <Field label={t('money.field_amount')}>{(id) => <Input id={id} inputMode="decimal" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />}</Field>
          <Field label={t('money.field_date')}>{(id) => <Input id={id} type="date" required max={todayStr()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
        </div>
        <Field label={t('money.field_category')}>{(id) => (
          <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {ECATS.map((c) => <option key={c} value={c}>{t('cat.' + c) || CATEGORY_LABEL[c]}</option>)}
          </Select>
        )}</Field>
        <Field label={t('money.field_paid_by')}>{(id) => <MemberSelect id={id} members={family.members} value={f.paidById} onChange={(v) => setF({ ...f, paidById: v })} />}</Field>
        <Field label={t('money.field_split')}>{() => <MemberChecks members={family.members} value={f.among} onChange={(v) => setF({ ...f, among: v })} />}</Field>
        <Field label={t('money.field_note')}>{(id) => <Input id={id} maxLength={200} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />}</Field>
        <Btn type="submit" disabled={busy}>{t('btn.add')}</Btn>
      </form>
    </Sheet>
  );
}

function Expenses() {
  const { t, lang } = useAuth();
  const [month, setMonth] = useState(thisMonth());
  const rep = useData(`/reports/monthly?month=${month}`, { deps: [month] });
  const list = useData(`/expenses?month=${month}`, { deps: [month] });
  const [adding, setAdding] = useState(false);
  const [run] = useAction();
  const confirm = useConfirm();
  const reload = () => { rep.reload(); list.reload(); };
  const max = Math.max(0, ...(rep.data?.byCategory.map((c) => c.total) || []));
  return (
    <>
      <div className="row between wrap" style={{ marginBottom: 12 }}>
        <div className="row"><Btn size="sm" tone="ghost" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>‹</Btn><b>{monthLabel(month, lang)}</b><Btn size="sm" tone="ghost" aria-label="Next month" disabled={month >= thisMonth()} onClick={() => setMonth(shiftMonth(month, 1))}>›</Btn></div>
        <Btn onClick={() => setAdding(true)}>{t('money.add_expense')}</Btn>
      </div>
      {rep.loading && !rep.data ? <Spinner /> : rep.error ? <ErrorNote error={rep.error} /> : (
        <section className="card" aria-label="Monthly summary">
          <div className="row between"><span className="muted small">{t('money.total_spent')}</span>{rep.data.vsLastMonth.changePercent != null ? <Badge tone={rep.data.vsLastMonth.changePercent > 0 ? 'warn' : 'ok'}>{rep.data.vsLastMonth.changePercent > 0 ? '+' : ''}{rep.data.vsLastMonth.changePercent}% vs last month</Badge> : null}</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{rupees(rep.data.total)}</div>
          <div className="col" style={{ gap: 8, marginTop: 8 }}>
            {rep.data.byCategory.map((c) => <div key={c.category}><div className="row between small"><span>{t('cat.' + c.category) || CATEGORY_LABEL[c.category]}</span><b>{rupees(c.total)}</b></div><Bar value={c.total} max={max} /></div>)}
            {!rep.data.byCategory.length ? <Empty>No spending recorded this month.</Empty> : null}
          </div>
          {rep.data.byMember.length ? <p className="small muted" style={{ marginBottom: 0 }}>{rep.data.byMember.map((m) => `${m.member?.displayName}: ${t('money.paid_by')} ${rupees(m.paid)}`).join(' · ')}</p> : null}
        </section>
      )}
      {list.data?.length ? (
        <div className="card list" style={{ marginTop: 12 }}>
          {list.data.map((e) => (
            <div key={e.id} className="item">
              <div className="grow">
                <div className="bold">{e.note || t('cat.' + e.category) || CATEGORY_LABEL[e.category]}</div>
                <div className="small muted">
                  {shortDate(e.date)} · {t('cat.' + e.category) || CATEGORY_LABEL[e.category]} · {t('money.paid_by')} {e.paidBy?.displayName}
                  {e.source !== 'manual' ? ` · ${t('cat.' + e.source) || e.source}` : ''}
                </div>
              </div>
              <b>{rupees(e.amount)}</b>
              <Btn size="sm" tone="ghost" aria-label="Delete expense" onClick={async () => { if (await confirm('Delete this expense?')) run(async () => { await del(`/expenses/${e.id}`); reload(); }, 'Deleted'); }}>{t('btn.delete')}</Btn>
            </div>))}
        </div>
      ) : null}
      {adding ? <ExpenseForm onClose={() => setAdding(false)} onDone={reload} /> : null}
    </>
  );
}

/* ---------- Wallet ---------- */
function SettleForm({ to, amount, onClose, onDone }) {
  const { t } = useAuth();
  const [v, setV] = useState(String(amount / 100));
  const [run, busy] = useAction();
  const save = async (e) => { e.preventDefault(); const a = toPaise(v); if (!a) return; if (await run(() => post('/wallet/settlements', { toId: to.membershipId, amount: a, date: todayStr() }), 'Settlement recorded')) { onDone(); onClose(); } };
  return (
    <Sheet title={`${t('dash.settle_up')} · ${to.displayName}`} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <p className="muted small" style={{ margin: 0 }}>{t('money.settle_cash_upi_hint')}</p>
        <Field label={t('money.field_amount')}>{(id) => <Input id={id} inputMode="decimal" required value={v} onChange={(e) => setV(e.target.value)} />}</Field>
        <Btn type="submit" disabled={busy}>{t('money.record_payment')}</Btn>
      </form>
    </Sheet>
  );
}
function Wallet() {
  const { t } = useAuth();
  const { data, error, loading, reload } = useData('/wallet');
  const hist = useData('/wallet/settlements');
  const [settle, setSettle] = useState(null);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  const { me } = data;
  return (
    <>
      <section className="card hero">
        <div className="small">{t('dash.wallet')}</div>
        <div style={{ fontSize: 32, fontWeight: 700 }}>{rupees(me.net, { sign: true })}</div>
        <div className="small">{me.net === 0 ? t('money.settled_up') : me.net > 0 ? t('dash.owed_to_you') : t('dash.you_owe')}</div>
      </section>
      {me.youOwe.length ? <section className="card" style={{ marginTop: 12 }}><h2>{t('dash.you_owe')}</h2><div className="list">{me.youOwe.map((o) => <div key={o.member.membershipId} className="item"><div className="grow bold">{o.member.displayName}</div><b>{rupees(o.amount)}</b><Btn size="sm" onClick={() => setSettle(o)}>{t('dash.settle_up')}</Btn></div>)}</div></section> : null}
      {me.owedToYou.length ? <section className="card" style={{ marginTop: 12 }}><h2>{t('dash.owed_to_you')}</h2><div className="list">{me.owedToYou.map((o) => <div key={o.member.membershipId} className="item"><div className="grow bold">{o.member.displayName}</div><b>{rupees(o.amount)}</b></div>)}</div></section> : null}
      <section className="card" style={{ marginTop: 12 }}><h2>{t('tasks.everyone')}</h2><div className="list">{data.balances.map((b) => <div key={b.member.membershipId} className="item"><div className="grow">{b.member.displayName}</div><b>{rupees(b.net, { sign: true })}</b></div>)}</div></section>
      {hist.data?.length ? <section className="card" style={{ marginTop: 12 }}><h2>{t('money.settle_balances')}</h2><div className="list">{hist.data.map((s) => <div key={s.id} className="item"><div className="grow small">{s.from?.displayName} paid {s.to?.displayName}<div className="muted">{shortDate(s.date)}</div></div><b>{rupees(s.amount)}</b></div>)}</div></section> : null}
      {settle ? <SettleForm to={settle.member} amount={settle.amount} onClose={() => setSettle(null)} onDone={() => { reload(); hist.reload(); }} /> : null}
    </>
  );
}

/* ---------- Loans ---------- */
function LoanForm({ onClose, onDone }) {
  const { t } = useAuth();
  const [f, setF] = useState({ lender: '', principal: '', interestRate: '0', emiAmount: '', emiDay: '5', startDate: todayStr(), tenureMonths: '12', outstanding: '', visibility: 'private' });
  const [run, busy] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const principal = toPaise(f.principal); if (!principal) return;
    const body = { lender: f.lender.trim(), principal, interestRate: Number(f.interestRate) || 0, emiDay: Number(f.emiDay), startDate: f.startDate, tenureMonths: Number(f.tenureMonths), visibility: f.visibility };
    if (f.emiAmount) { const a = toPaise(f.emiAmount); if (!a) return; body.emiAmount = a; }
    if (f.outstanding) { const o = toPaise(f.outstanding); if (!o) return; body.outstanding = o; }
    if (await run(() => post('/loans', body), 'Loan added')) { onDone(); onClose(); }
  };
  return (
    <Sheet title={t('money.add_loan')} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <Field label={t('money.field_lender')}>{(id) => <Input id={id} required maxLength={80} value={f.lender} onChange={set('lender')} />}</Field>
        <div className="row wrap">
          <Field label={t('money.field_principal')}>{(id) => <Input id={id} inputMode="decimal" required value={f.principal} onChange={set('principal')} />}</Field>
          <Field label={t('money.field_interest')}>{(id) => <Input id={id} type="number" step="0.01" min={0} max={60} value={f.interestRate} onChange={set('interestRate')} />}</Field>
        </div>
        <div className="row wrap">
          <Field label={t('money.field_tenure')}>{(id) => <Input id={id} type="number" min={1} max={600} required value={f.tenureMonths} onChange={set('tenureMonths')} />}</Field>
          <Field label={t('money.field_emi_day')}>{(id) => <Input id={id} type="number" min={1} max={28} required value={f.emiDay} onChange={set('emiDay')} />}</Field>
          <Field label={t('med.field_start')}>{(id) => <Input id={id} type="date" required value={f.startDate} onChange={set('startDate')} />}</Field>
        </div>
        <div className="row wrap">
          <Field label={t('money.field_emi')} hint={t('money.emi_hint')}>{(id) => <Input id={id} inputMode="decimal" value={f.emiAmount} onChange={set('emiAmount')} />}</Field>
          <Field label={t('money.field_outstanding')} hint={t('money.outstanding_hint')}>{(id) => <Input id={id} inputMode="decimal" value={f.outstanding} onChange={set('outstanding')} />}</Field>
        </div>
        <Field label={t('money.field_visibility')}>{(id) => <Select id={id} value={f.visibility} onChange={set('visibility')}><option value="private">{t('money.vis_private')}</option><option value="family">{t('money.vis_family')}</option></Select>}</Field>
        <Btn type="submit" disabled={busy}>{t('btn.save')}</Btn>
      </form>
    </Sheet>
  );
}
function PayLoan({ loan, onClose, onDone }) {
  const { t } = useAuth();
  const [v, setV] = useState(String(loan.emiAmount / 100));
  const [run, busy] = useAction();
  const save = async (e) => { e.preventDefault(); const a = toPaise(v); if (!a) return; if (await run(() => post(`/loans/${loan.id}/payments`, { paidOn: todayStr(), amount: a }), 'Payment recorded')) { onDone(); onClose(); } };
  return (
    <Sheet title={`${loan.lender} · ${t('money.record_payment')}`} onClose={onClose}>
      <form className="col" onSubmit={save}><Field label={t('money.field_amount')}>{(id) => <Input id={id} inputMode="decimal" required value={v} onChange={(e) => setV(e.target.value)} />}</Field><Btn type="submit" disabled={busy}>{t('money.record_payment')}</Btn></form>
    </Sheet>
  );
}
function Loans() {
  const { me, t } = useAuth();
  const { data, error, loading, reload } = useData('/loans');
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState(null);
  const [run] = useAction();
  const confirm = useConfirm();
  return (
    <>
      <div style={{ marginBottom: 12 }}><Btn onClick={() => setAdding(true)}>{t('money.tab_loans')}</Btn></div>
      {loading && !data ? <Spinner /> : error ? <ErrorNote error={error} /> : !data.length ? <Empty>No loans. Private loans are visible only to you.</Empty> : (
        <div className="col">{data.map((l) => (
          <section key={l.id} className="card">
            <div className="row between"><h2>{l.lender}</h2><Badge tone={l.visibility === 'private' ? 'info' : ''}>{l.visibility === 'private' ? 'Private' : 'Family'}</Badge></div>
            <div className="small muted">Owner: {l.owner?.displayName} · {l.interestRate}% · EMI {rupees(l.emiAmount)} on day {l.emiDay}</div>
            <div className="row between" style={{ marginTop: 8 }}><span>Outstanding <b>{rupees(l.outstanding)}</b></span><span className="small muted">of {rupees(l.principal)}</span></div>
            <Bar value={l.progressPercent} max={100} />
            <div className="small muted" style={{ marginTop: 4 }}>{l.closed ? 'Closed' : `${l.progressPercent}% repaid · next EMI ${shortDate(l.nextEmiDate)}`}</div>
            {l.owner?.membershipId === me && !l.closed ? <div className="row" style={{ marginTop: 8 }}><Btn size="sm" onClick={() => setPaying(l)}>{t('money.record_payment')}</Btn><Btn size="sm" tone="ghost" onClick={async () => { if (await confirm('Delete this loan and its history?')) run(async () => { await del(`/loans/${l.id}`); reload(); }, 'Deleted'); }}>{t('btn.delete')}</Btn></div> : null}
          </section>))}</div>
      )}
      {adding ? <LoanForm onClose={() => setAdding(false)} onDone={reload} /> : null}
      {paying ? <PayLoan loan={paying} onClose={() => setPaying(null)} onDone={reload} /> : null}
    </>
  );
}

/* ---------- Tax report ---------- */
function Tax() {
  const { t } = useAuth();
  const now = new Date(); const fyNow = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [fy, setFy] = useState(fyNow);
  const { data, error, loading } = useData(`/reports/tax?fy=${fy}`, { deps: [fy] });
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}><Btn size="sm" tone="ghost" onClick={() => setFy(fy - 1)}>‹</Btn><b>FY {fy}-{String(fy + 1).slice(2)}</b><Btn size="sm" tone="ghost" disabled={fy >= fyNow} onClick={() => setFy(fy + 1)}>›</Btn></div>
      {loading && !data ? <Spinner /> : error ? <ErrorNote error={error} /> : (
        <>
          <section className="card hero"><div className="small">Tax paid {data.from} to {data.to}</div><div style={{ fontSize: 28, fontWeight: 700 }}>{rupees(data.totalPaid)}</div></section>
          <h2 style={{ marginTop: 16 }}>Payments</h2>
          {!data.payments.length ? <Empty>No tax payments recorded. Create a “Tax” bill and mark it paid.</Empty> : <div className="card list">{data.payments.map((p) => <div key={p.id} className="item"><div className="grow"><div className="bold">{p.note || 'Tax'}</div><div className="small muted">{shortDate(p.date)} · paid by {p.paidBy?.displayName}</div></div><b>{rupees(p.amount)}</b></div>)}</div>}
          <h2 style={{ marginTop: 16 }}>Upcoming tax bills</h2>
          {!data.upcoming.length ? <Empty>No tax bills set up (house tax, land tax…).</Empty> : <div className="card list">{data.upcoming.map((b) => <div key={b.id} className="item"><div className="grow bold">{b.title}</div><span className="small muted">next {shortDate(b.nextDue)}</span></div>)}</div>}
          <p className="small muted">Tip: print this page for your records. Upload tax receipts in Documents.</p>
        </>
      )}
    </>
  );
}

export default function MoneyPage() {
  const { t } = useAuth();
  const [tab, setTab] = useState('expenses');
  return (
    <>
      <PageHeader title={t('money.title')} sub={t('money.sub')} />
      <Tabs value={tab} onChange={setTab} items={[['expenses', t('money.tab_expenses')], ['wallet', t('money.tab_wallet')], ['loans', t('money.tab_loans')], ['tax', t('money.tab_tax')]]} />
      <div style={{ marginTop: 12 }}>{tab === 'expenses' ? <Expenses /> : tab === 'wallet' ? <Wallet /> : tab === 'loans' ? <Loans /> : <Tax />}</div>
    </>
  );
}
