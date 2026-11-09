'use client';
import { useState } from 'react';
import { del, patch, post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Badge, Btn, Empty, ErrorNote, Field, Input, MemberChecks, MemberSelect, PageHeader, Select, Sheet, Spinner, Tabs, useAction, useConfirm } from '@/components/ui';
import { CATEGORY_LABEL, daysLabel, rupees, shortDate, timeAgo, todayStr, toPaise } from '@/lib/format';

const CATS = ['electricity', 'water', 'internet', 'phone', 'gas', 'rent', 'tax', 'insurance', 'emi', 'subscription', 'school', 'other'];
const UNIT = { day: 'day', week: 'week', month: 'month', year: 'year', once: 'once' };
const every = (r, t) => {
  if (r.unit === 'once') return t ? t('bills.unit_once') : 'One time';
  const unitStr = t ? t(`bills.unit_${r.unit}s`) || r.unit : UNIT[r.unit];
  return r.everyN === 1 ? `${t ? t('bills.field_repeats_every') : 'Every'} ${unitStr}` : `${t ? t('bills.field_repeats_every') : 'Every'} ${r.everyN} ${unitStr}`;
};

function AmountSheet({ inst, onClose, onDone }) {
  const { t } = useAuth();
  const [v, setV] = useState(inst.amount != null ? String(inst.amount / 100) : '');
  const [run, busy] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const amount = toPaise(v);
    if (!amount) return;
    if (await run(() => post(`/bill-instances/${inst.id}/amount`, { amount }), 'Amount saved')) {
      onDone();
      onClose();
    }
  };
  return (
    <Sheet title={`${inst.billTitle} · ${t('money.field_amount')}`} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <Field label={t('money.field_amount')}>{(id) => <Input id={id} inputMode="decimal" required value={v} onChange={(e) => setV(e.target.value)} />}</Field>
        <Btn type="submit" disabled={busy}>{t('btn.save')}</Btn>
      </form>
    </Sheet>
  );
}

function EditBillSheet({ bill, onClose, onDone }) {
  const { family, t } = useAuth();
  const [f, setF] = useState({
    title: bill.title || '',
    category: bill.category || 'electricity',
    amountMode: bill.amountMode || 'ask',
    fixed: bill.fixedAmount ? String(bill.fixedAmount / 100) : '',
    unit: bill.rule?.unit || 'month',
    everyN: bill.rule?.everyN || 1,
    anchorDate: bill.rule?.anchorDate || todayStr(),
    payerId: bill.payer?.membershipId || null,
    reminderDaysBefore: bill.reminderDaysBefore ?? 3,
    splitAmong: (bill.splitAmong || []).map((m) => m.membershipId),
    note: bill.note || '',
  });
  const [run, busy] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const rule = {
      unit: f.unit,
      everyN: Math.max(1, Math.min(60, Number(f.everyN) || 1)),
      anchorDate: f.anchorDate,
    };
    const body = {
      title: f.title.trim(),
      category: f.category,
      amountMode: f.amountMode,
      rule,
      reminderDaysBefore: Number(f.reminderDaysBefore) || 0,
      splitAmong: f.splitAmong,
      payerId: f.payerId || null,
      note: f.note.trim(),
    };
    if (f.amountMode === 'fixed') {
      const a = toPaise(f.fixed);
      if (!a) return;
      body.fixedAmount = a;
    }
    if (await run(() => patch(`/bills/${bill.id}`, body), 'Bill updated')) {
      onDone();
      onClose();
    }
  };

  return (
    <Sheet title={`${t('btn.edit')} · ${bill.title}`} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <Field label={t('recipes.field_name')}>{(id) => <Input id={id} required maxLength={80} value={f.title} onChange={set('title')} />}</Field>
        <div className="row wrap">
          <Field label={t('money.field_category')}>
            {(id) => (
              <Select id={id} value={f.category} onChange={set('category')}>
                {CATS.map((c) => <option key={c} value={c}>{t('cat.' + c) || CATEGORY_LABEL[c]}</option>)}
              </Select>
            )}
          </Field>
          <Field label={t('money.field_amount')}>
            {(id) => (
              <Select id={id} value={f.amountMode} onChange={set('amountMode')}>
                <option value="ask">{t('bills.amount_ask')}</option>
                <option value="fixed">{t('bills.amount_fixed')}</option>
              </Select>
            )}
          </Field>
        </div>
        {f.amountMode === 'fixed' ? (
          <Field label={t('bills.field_fixed_amount')}>{(id) => <Input id={id} inputMode="decimal" required value={f.fixed} onChange={set('fixed')} />}</Field>
        ) : null}
        <div className="row wrap">
          <Field label={t('bills.field_repeats_every')}>{(id) => <Input id={id} type="number" min={1} max={60} style={{ width: 80 }} value={f.everyN} onChange={set('everyN')} />}</Field>
          <Field label={t('bills.field_unit')}>
            {(id) => (
              <Select id={id} value={f.unit} onChange={set('unit')}>
                <option value="day">{t('bills.unit_days')}</option>
                <option value="week">{t('bills.unit_weeks')}</option>
                <option value="month">{t('bills.unit_months')}</option>
                <option value="year">{t('bills.unit_years')}</option>
                <option value="once">{t('bills.unit_once')}</option>
              </Select>
            )}
          </Field>
          <Field label={t('bills.field_first_due')}>{(id) => <Input id={id} type="date" required value={f.anchorDate} onChange={set('anchorDate')} />}</Field>
        </div>
        <div className="row wrap">
          <Field label={t('bills.field_who_pays')}>{(id) => <MemberSelect id={id} members={family.members} value={f.payerId} onChange={(v) => setF({ ...f, payerId: v })} allowNone noneLabel={t('bills.anyone_pays')} />}</Field>
          <Field label={t('bills.field_remind_days')}>{(id) => <Input id={id} type="number" min={0} max={30} style={{ width: 90 }} value={f.reminderDaysBefore} onChange={set('reminderDaysBefore')} />}</Field>
        </div>
        <Field label={t('bills.field_split_among')} hint={t('bills.split_hint')}>{() => <MemberChecks members={family.members} value={f.splitAmong} onChange={(v) => setF({ ...f, splitAmong: v })} />}</Field>
        <Field label={t('money.field_note')}>{(id) => <Input id={id} maxLength={300} value={f.note} onChange={set('note')} />}</Field>
        <Btn type="submit" disabled={busy}>{t('tasks.save_btn')}</Btn>
      </form>
    </Sheet>
  );
}

function NewBill({ onClose, onDone }) {
  const { family, t } = useAuth();
  const [f, setF] = useState({ title: '', category: 'electricity', amountMode: 'ask', fixed: '', unit: 'month', everyN: 2, anchorDate: todayStr(), payerId: null, reminderDaysBefore: 3, splitAmong: [], note: '' });
  const [run, busy] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const rule = { unit: f.unit, everyN: Math.max(1, Math.min(60, Number(f.everyN) || 1)), anchorDate: f.anchorDate };
    const body = { title: f.title.trim(), category: f.category, amountMode: f.amountMode, rule, reminderDaysBefore: Number(f.reminderDaysBefore) || 0, splitAmong: f.splitAmong };
    if (f.payerId) body.payerId = f.payerId;
    if (f.note.trim()) body.note = f.note.trim();
    if (f.amountMode === 'fixed') { const a = toPaise(f.fixed); if (!a) return; body.fixedAmount = a; }
    if (await run(() => post('/bills', body), 'Bill created')) { onDone(); onClose(); }
  };
  return (
    <Sheet title={t('bills.new_bill_title')} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <Field label={t('recipes.field_name')}>{(id) => <Input id={id} required maxLength={80} value={f.title} onChange={set('title')} placeholder={t('bills.placeholder_name')} />}</Field>
        <div className="row wrap">
          <Field label={t('money.field_category')}>{(id) => <Select id={id} value={f.category} onChange={set('category')}>{CATS.map((c) => <option key={c} value={c}>{t('cat.' + c) || CATEGORY_LABEL[c]}</option>)}</Select>}</Field>
          <Field label={t('money.field_amount')}>{(id) => <Select id={id} value={f.amountMode} onChange={set('amountMode')}><option value="ask">{t('bills.amount_ask')}</option><option value="fixed">{t('bills.amount_fixed')}</option></Select>}</Field>
        </div>
        {f.amountMode === 'fixed' ? <Field label={t('bills.field_fixed_amount')}>{(id) => <Input id={id} inputMode="decimal" required value={f.fixed} onChange={set('fixed')} />}</Field> : null}
        <div className="row wrap">
          <Field label={t('bills.field_repeats_every')}>{(id) => <Input id={id} type="number" min={1} max={60} style={{ width: 80 }} value={f.everyN} onChange={set('everyN')} />}</Field>
          <Field label={t('bills.field_unit')}>{(id) => <Select id={id} value={f.unit} onChange={set('unit')}><option value="day">{t('bills.unit_days')}</option><option value="week">{t('bills.unit_weeks')}</option><option value="month">{t('bills.unit_months')}</option><option value="year">{t('bills.unit_years')}</option><option value="once">{t('bills.unit_once')}</option></Select>}</Field>
          <Field label={t('bills.field_first_due')}>{(id) => <Input id={id} type="date" required value={f.anchorDate} onChange={set('anchorDate')} />}</Field>
        </div>
        <div className="row wrap">
          <Field label={t('bills.field_who_pays')}>{(id) => <MemberSelect id={id} members={family.members} value={f.payerId} onChange={(v) => setF({ ...f, payerId: v })} allowNone noneLabel={t('bills.anyone_pays')} />}</Field>
          <Field label={t('bills.field_remind_days')}>{(id) => <Input id={id} type="number" min={0} max={30} style={{ width: 90 }} value={f.reminderDaysBefore} onChange={set('reminderDaysBefore')} />}</Field>
        </div>
        <Field label={t('bills.field_split_among')} hint={t('bills.split_hint')}>{() => <MemberChecks members={family.members} value={f.splitAmong} onChange={(v) => setF({ ...f, splitAmong: v })} />}</Field>
        <Field label={t('money.field_note')}>{(id) => <Input id={id} maxLength={300} value={f.note} onChange={set('note')} />}</Field>
        <Btn type="submit" disabled={busy}>{t('bills.create_btn')}</Btn>
      </form>
    </Sheet>
  );
}

function Instances({ status }) {
  const { family, me, t, lang } = useAuth();
  const { data, error, loading, reload } = useData(`/bill-instances?status=${status}`, { interval: 30000 });
  const [run] = useAction();
  const [amountFor, setAmountFor] = useState(null);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  if (!data.length) return <Empty>{status === 'open' ? t('bills.no_bills') : t('bills.no_paid')}</Empty>;
  const pay = (i) => run(async () => { await post(`/bill-instances/${i.id}/pay`, {}); reload(); }, 'Marked as paid');
  return (
    <>
      <div className="card list">
        {data.map((i) => {
          const canManage = i.createdBy?.membershipId === me || i.payer?.membershipId === me || family.myRole !== 'member';
          return (
            <div key={i.id} className="item" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div className="bold">{i.billTitle}</div>
                <div className="small muted">{t('cat.' + i.category) || CATEGORY_LABEL[i.category]} · due {shortDate(i.dueDate, lang)}{i.status !== 'paid' ? ` (${daysLabel(i.daysLeft)})` : ''}{i.payer ? ` · ${i.payer.displayName} pays` : ''}</div>
                {i.status === 'paid' ? <div className="small muted">Paid by {i.paidBy?.displayName} {i.paidAt ? timeAgo(i.paidAt) : ''}</div> : null}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="bold">{i.amount != null ? rupees(i.amount) : '—'}</div>
                {i.status === 'paid' ? <Badge tone="ok">{t('bills.paid')}</Badge> : i.overdue ? <Badge tone="danger">Overdue</Badge> : i.status === 'awaiting_amount' ? <Badge tone="warn">{t('dash.amount_needed')}</Badge> : null}
              </div>
              {i.status === 'awaiting_amount' ? (
                <Btn size="sm" onClick={() => setAmountFor(i)}>{t('btn.add')}</Btn>
              ) : i.status !== 'paid' ? (
                <div className="row" style={{ gap: 6 }}>
                  {canManage ? <Btn size="sm" tone="ghost" onClick={() => setAmountFor(i)}>Edit ₹</Btn> : null}
                  <Btn size="sm" onClick={() => pay(i)}>{t('bills.paid')}</Btn>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {amountFor ? <AmountSheet inst={amountFor} onClose={() => setAmountFor(null)} onDone={reload} /> : null}
    </>
  );
}

function Schedules() {
  const { data, error, loading, reload } = useData('/bills');
  const { family, me, t, lang } = useAuth();
  const [run] = useAction();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  return (
    <>
      <div style={{ marginBottom: 12 }}><Btn onClick={() => setAdding(true)}>{t('bills.new_bill')}</Btn></div>
      {loading && !data ? <Spinner /> : error ? <ErrorNote error={error} /> : !data.length ? <Empty>No recurring bills.</Empty> : (
        <div className="col">{data.map((b) => {
          const canManage = b.createdBy?.membershipId === me || family.myRole !== 'member';
          return (
            <section key={b.id} className="card">
              <div className="row between"><h2>{b.title}</h2><Badge tone="info">{t('cat.' + b.category) || CATEGORY_LABEL[b.category]}</Badge></div>
              <div className="small muted">{b.payer ? `${b.payer.displayName} pays · ` : ''}{every(b.rule, t)} · next {shortDate(b.nextDue, lang)}{b.amountMode === 'fixed' && b.fixedAmount ? ` · ${rupees(b.fixedAmount)}` : ''}</div>
              {canManage ? (
                <div className="row" style={{ marginTop: 8 }}>
                  <Btn size="sm" tone="ghost" onClick={() => setEditing(b)}>{t('btn.edit')}</Btn>
                  <Btn size="sm" tone="ghost" onClick={async () => { const msg = 'Delete ' + b.title + '?'; if (await confirm(msg)) run(async () => { await del(`/bills/${b.id}`); reload(); }, 'Deleted'); }}>{t('btn.delete')}</Btn>
                </div>
              ) : null}
            </section>
          );
        })}</div>
      )}
      {adding ? <NewBill onClose={() => setAdding(false)} onDone={reload} /> : null}
      {editing ? <EditBillSheet bill={editing} onClose={() => setEditing(null)} onDone={reload} /> : null}
    </>
  );
}

export default function BillsPage({ embedded = false }) {
  const { t } = useAuth();
  const [tab, setTab] = useState('open');
  return (
    <>
      {embedded ? null : <PageHeader title={t('bills.title')} sub={t('bills.sub')} />}
      <Tabs value={tab} onChange={setTab} items={[['open', t('bills.to_pay')], ['paid', t('bills.paid')], ['schedules', t('bills.recurring')]]} />
      <div style={{ marginTop: 12 }}>{tab === 'schedules' ? <Schedules /> : <Instances key={tab} status={tab} />}</div>
    </>
  );
}
