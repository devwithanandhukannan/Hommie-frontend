'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { del, patch, post } from '@/lib/api';
import { useAuth, useData, notifyChanged } from '@/lib/auth';
import { Badge, Btn, Empty, ErrorNote, Field, Input, MemberChecks, MemberSelect, Select, Sheet, Spinner, Tabs, useAction, useConfirm } from '@/components/ui';
import { CATEGORY_LABEL, rupees, shortDate, timeAgo, todayStr, toPaise } from '@/lib/format';
import BillsPage from '../bills/page';

const ECATS = ['grocery', 'food', 'bills', 'transport', 'medical', 'household', 'rent', 'shopping', 'education', 'entertainment', 'emi', 'tax', 'other'];
const QUICK_CATS = ['grocery', 'food', 'bills', 'transport', 'medical', 'other'];
const TABS = ['expenses', 'wallet', 'bills'];

const thisMonth = () => todayStr().slice(0, 7);
const shiftMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const monthLabel = (m, lang = 'en') => {
  const locale = lang === 'ml' ? 'ml-IN' : lang === 'ta' ? 'ta-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
  return new Date(`${m}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

function catLabel(t, key) {
  if (!key) return '';
  const norm = key === 'bill' ? 'bills' : key;
  const k = `cat.${norm}`;
  const v = t(k);
  if (v && v !== k) return v;
  return CATEGORY_LABEL[key] || CATEGORY_LABEL[norm] || key;
}

function Bar({ value, max }) {
  return <div className="bar" aria-hidden="true"><span style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} /></div>;
}

/* ---------- Expenses + monthly report ---------- */
function ExpenseSheet({ expense = null, onClose, onDone }) {
  const { family, isAdmin, t } = useAuth();
  const confirm = useConfirm();
  const [run, busy] = useAction();
  const isEdit = Boolean(expense);
  const all = family.members.map((m) => m.membershipId);
  const [f, setF] = useState({
    amount: expense ? String(expense.amount / 100) : '',
    category: expense?.category === 'bill' ? 'bills' : expense?.category || 'grocery',
    date: expense?.date || todayStr(),
    note: expense?.note || '',
    paidById: expense?.paidBy?.membershipId || family.myMembershipId,
    among: all,
  });
  const [more, setMore] = useState(false);

  const chipCats = QUICK_CATS.includes(f.category) ? QUICK_CATS : [...QUICK_CATS, f.category];

  const save = async (e) => {
    e.preventDefault();
    const amount = toPaise(f.amount);
    if (!amount) return;
    if (isEdit) {
      const body = { amount, category: f.category, date: f.date, note: f.note.trim() };
      const updated = await run(() => patch(`/expenses/${expense.id}`, body), 'Updated');
      if (updated) { onDone({ updated, prev: expense }); notifyChanged(); onClose(); }
      return;
    }
    if (!f.among.length) return;
    const body = { amount, category: f.category, date: f.date, paidById: f.paidById, equalAmong: f.among };
    if (f.note.trim()) body.note = f.note.trim();
    const created = await run(() => post('/expenses', body), 'Expense added');
    if (created) { onDone({ created }); notifyChanged(); onClose(); }
  };

  const remove = async () => {
    if (!expense || !(await confirm('Delete this expense?'))) return;
    if (await run(() => del(`/expenses/${expense.id}`), 'Deleted')) { onDone({ deletedId: expense.id, prev: expense }); notifyChanged(); onClose(); }
  };

  return (
    <Sheet title={isEdit ? (expense.note || catLabel(t, expense.category)) : t('money.add_expense')} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <div className="amount-field">
          <span>₹</span>
          <input autoFocus required inputMode="decimal" aria-label={t('money.field_amount')} placeholder="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </div>
        <Input aria-label={t('money.field_note')} placeholder={t('add.expense_ph') || 'What was it for?'} maxLength={200} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />

        <div className="exp-cats" role="radiogroup" aria-label={t('money.field_category')}>
          {chipCats.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={f.category === c} className={`exp-cat ${f.category === c ? 'on' : ''}`} onClick={() => setF({ ...f, category: c })}>
              {catLabel(t, c)}
            </button>
          ))}
        </div>

        {more ? (
          <div className="col">
            <div className="row wrap">
              <Field label={t('money.field_category')}>{(id) => (
                <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                  {ECATS.map((c) => <option key={c} value={c}>{catLabel(t, c)}</option>)}
                </Select>
              )}</Field>
              <Field label={t('money.field_date')}>{(id) => <Input id={id} type="date" required max={todayStr()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
            </div>
            {!isEdit && family.members.length > 1 ? (
              <>
                {isAdmin ? <Field label={t('money.field_paid_by')}>{(id) => <MemberSelect id={id} members={family.members} value={f.paidById} onChange={(v) => setF({ ...f, paidById: v })} />}</Field> : null}
                <Field label={t('money.field_split')}>{() => <MemberChecks members={family.members} value={f.among} onChange={(v) => setF({ ...f, among: v })} />}</Field>
              </>
            ) : null}
          </div>
        ) : (
          <button type="button" className="link-btn" onClick={() => setMore(true)}>{t('add.more')}</button>
        )}

        <Btn type="submit" disabled={busy || !toPaise(f.amount)}>{isEdit ? t('btn.save') : t('btn.add')}</Btn>
        {isEdit ? <Btn type="button" tone="ghost" onClick={remove} disabled={busy}>{t('btn.delete')}</Btn> : null}
      </form>
    </Sheet>
  );
}

function GroceryBillSheet({ items, onClose, onDone }) {
  const { t } = useAuth();
  const [run, busy] = useAction();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState(() => new Set(items.map((g) => g.id)));

  const picked = items.filter((g) => selected.has(g.id)).map((g) => g.id);
  const allSelected = picked.length === items.length && items.length > 0;
  const paise = toPaise(amount);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((g) => g.id)));

  const submit = async (e) => {
    e.preventDefault();
    if (!picked.length || !paise) return;
    const body = { itemIds: picked, amount: paise, date: todayStr() };
    if (note.trim()) body.note = note.trim();
    const res = await run(() => post('/grocery/bill', body), 'Grocery expense added');
    if (res) {
      onDone({ created: res.expense, billedIds: picked });
      notifyChanged();
      onClose();
    }
  };

  const skipSelected = async () => {
    if (!picked.length) return;
    if (await run(() => post('/grocery/bill', { itemIds: picked, skip: true }), 'Skipped')) {
      onDone({ billedIds: picked });
      notifyChanged();
      onClose();
    }
  };

  return (
    <Sheet title="Grocery bill" onClose={onClose}>
      <form className="col" onSubmit={submit}>
        <div className="amount-field">
          <span>₹</span>
          <input autoFocus required inputMode="decimal" aria-label={t('money.field_amount')} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Input aria-label={t('money.field_note')} placeholder="Supermarket, Vegetables…" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />

        <div className="row between" style={{ marginTop: 4 }}>
          <span className="small muted">Items included ({picked.length}/{items.length})</span>
          <button type="button" className="link-btn" onClick={toggleAll}>
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        </div>

        <div className="bill-pick-list">
          {items.map((g) => {
            const sub = [g.qty, g.lastBought?.at ? timeAgo(g.lastBought.at) : ''].filter(Boolean).join(' · ');
            return (
              <label key={g.id} className="bill-pick-row">
                <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggle(g.id)} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="bold">{g.name}</div>
                  {sub ? <div className="small muted">{sub}</div> : null}
                </div>
              </label>
            );
          })}
        </div>

        <div className="col" style={{ gap: 8, marginTop: 4 }}>
          <Btn type="submit" disabled={busy || !picked.length || !paise}>
            {t('btn.save')} ({picked.length})
          </Btn>
          <Btn type="button" tone="ghost" disabled={busy || !picked.length} onClick={skipSelected}>
            Skip
          </Btn>
        </div>
      </form>
    </Sheet>
  );
}

function patchMonthlyReport(prev, month, oldExp, newExp) {
  if (!prev) return prev;
  const inOld = oldExp && oldExp.date?.slice(0, 7) === month ? oldExp : null;
  const inNew = newExp && newExp.date?.slice(0, 7) === month ? newExp : null;
  if (!inOld && !inNew) return prev;
  const cats = new Map((prev.byCategory || []).map((c) => [c.category, c.total]));
  let total = prev.total || 0;
  if (inOld) {
    total = Math.max(0, total - inOld.amount);
    const next = (cats.get(inOld.category) || 0) - inOld.amount;
    if (next > 0) cats.set(inOld.category, next); else cats.delete(inOld.category);
  }
  if (inNew) {
    total += inNew.amount;
    cats.set(inNew.category, (cats.get(inNew.category) || 0) + inNew.amount);
  }
  const lastTotal = prev.vsLastMonth?.lastTotal || 0;
  return {
    ...prev,
    total,
    byCategory: [...cats].map(([category, tot]) => ({ category, total: tot })).sort((a, b) => b.total - a.total),
    vsLastMonth: { lastTotal, changePercent: lastTotal ? Math.round(((total - lastTotal) / lastTotal) * 100) : null },
  };
}

function Expenses({ unbilled = [], onBilled }) {
  const { t, lang } = useAuth();
  const [month, setMonth] = useState(thisMonth());
  const rep = useData(`/reports/monthly?month=${month}`, { deps: [month] });
  const list = useData(`/expenses?month=${month}`, { deps: [month] });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [billOpen, setBillOpen] = useState(false);
  const applyChange = (chg) => {
    if (chg?.updated?.id) {
      const oldItem = chg.prev || list.data?.find((x) => x.id === chg.updated.id) || null;
      list.setData((prev) => {
        if (!prev) return prev;
        if (chg.updated.date?.slice(0, 7) !== month) return prev.filter((x) => x.id !== chg.updated.id);
        return prev.map((x) => (x.id === chg.updated.id ? chg.updated : x));
      });
      rep.setData((prev) => patchMonthlyReport(prev, month, oldItem, chg.updated));
    } else if (chg?.created?.id && chg.created.date?.slice(0, 7) === month) {
      list.setData((prev) => (prev ? [chg.created, ...prev] : [chg.created]));
      rep.setData((prev) => patchMonthlyReport(prev, month, null, chg.created));
    } else if (chg?.deletedId) {
      const oldItem = chg.prev || list.data?.find((x) => x.id === chg.deletedId) || null;
      list.setData((prev) => (prev ? prev.filter((x) => x.id !== chg.deletedId) : prev));
      rep.setData((prev) => patchMonthlyReport(prev, month, oldItem, null));
    }
    if (chg?.billedIds?.length) onBilled?.(chg.billedIds);
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
      rep.reload();
      list.reload();
    }
  };
  const max = Math.max(0, ...(rep.data?.byCategory.map((c) => c.total) || []));
  const payers = (rep.data?.byMember || []).filter((m) => m.paid > 0 && m.member?.displayName);
  const previewNames = unbilled.slice(0, 3).map((g) => g.name).join(', ');
  const extra = unbilled.length > 3 ? ` +${unbilled.length - 3}` : '';

  return (
    <>
      {unbilled.length ? (
        <button type="button" className="unbilled-banner" onClick={() => setBillOpen(true)}>
          <span className="unbilled-dot" aria-hidden="true" />
          <div className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
            <div className="bold">{unbilled.length} unbilled {unbilled.length === 1 ? 'grocery item' : 'grocery items'}</div>
            <div className="small muted unbilled-preview">{previewNames}{extra}</div>
          </div>
          <span className="unbilled-cta">Add bill ›</span>
        </button>
      ) : null}

      <div className="row between wrap" style={{ marginBottom: 12 }}>
        <div className="row">
          <Btn size="sm" tone="ghost" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>‹</Btn>
          <b>{monthLabel(month, lang)}</b>
          <Btn size="sm" tone="ghost" aria-label="Next month" disabled={month >= thisMonth()} onClick={() => setMonth(shiftMonth(month, 1))}>›</Btn>
        </div>
        <Btn onClick={() => setAdding(true)}>{t('money.add_expense')}</Btn>
      </div>

      <div className="money-grid">
        <div>
          {rep.loading && !rep.data ? <Spinner /> : rep.error ? <ErrorNote error={rep.error} /> : (
            <section className="card" aria-label="Monthly summary">
              <div className="row between">
                <span className="muted small">{t('money.total_spent')}</span>
                {rep.data.vsLastMonth.changePercent != null ? (
                  <Badge tone={rep.data.vsLastMonth.changePercent > 0 ? 'warn' : 'ok'}>
                    {rep.data.vsLastMonth.changePercent > 0 ? '+' : ''}{rep.data.vsLastMonth.changePercent}% vs last month
                  </Badge>
                ) : null}
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2 }}>{rupees(rep.data.total)}</div>
              <div className="col" style={{ gap: 8, marginTop: 12 }}>
                {rep.data.byCategory.map((c) => (
                  <div key={c.category}>
                    <div className="row between small"><span>{catLabel(t, c.category)}</span><b>{rupees(c.total)}</b></div>
                    <Bar value={c.total} max={max} />
                  </div>
                ))}
                {!rep.data.byCategory.length ? <Empty>No spending recorded this month.</Empty> : null}
              </div>
              {payers.length > 1 ? (
                <p className="small muted" style={{ marginBottom: 0, marginTop: 12 }}>
                  {payers.map((m) => `${m.member.displayName} ${rupees(m.paid)}`).join(' · ')}
                </p>
              ) : null}
            </section>
          )}
        </div>

        <div>
          {list.loading && !list.data ? <Spinner /> : list.data?.length ? (
            <div className="card list">
              {list.data.map((e) => {
                const title = e.note || catLabel(t, e.category);
                const sub = [shortDate(e.date, lang), catLabel(t, e.category), e.paidBy?.displayName].filter(Boolean).join(' · ');
                if (e.source === 'bill') {
                  return (
                    <div key={e.id} className="item">
                      <div className="grow"><div className="bold">{title}</div><div className="small muted">{sub}</div></div>
                      <b>{rupees(e.amount)}</b>
                    </div>
                  );
                }
                return (
                  <button key={e.id} type="button" className="item exp-row" onClick={() => setEditing(e)}>
                    <div className="grow"><div className="bold">{title}</div><div className="small muted">{sub}</div></div>
                    <b>{rupees(e.amount)}</b>
                    <span className="muted" aria-hidden="true">›</span>
                  </button>
                );
              })}
            </div>
          ) : list.data ? (
            <div className="card">
              <Empty>No spending recorded this month.</Empty>
            </div>
          ) : null}
        </div>
      </div>

      {adding ? <ExpenseSheet onClose={() => setAdding(false)} onDone={applyChange} /> : null}
      {editing ? <ExpenseSheet key={editing.id} expense={editing} onClose={() => setEditing(null)} onDone={applyChange} /> : null}
      {billOpen && unbilled.length ? <GroceryBillSheet items={unbilled} onClose={() => setBillOpen(false)} onDone={applyChange} /> : null}
    </>
  );
}

/* ---------- Wallet ---------- */
function SettleForm({ to, amount, onClose, onDone }) {
  const { t } = useAuth();
  const [v, setV] = useState(String(amount / 100));
  const [run, busy] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const a = toPaise(v);
    if (!a) return;
    if (await run(() => post('/wallet/settlements', { toId: to.membershipId, amount: a, date: todayStr() }), 'Settlement recorded')) {
      notifyChanged();
      onDone();
      onClose();
    }
  };
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
  const { t, family, lang } = useAuth();
  const [undoRun] = useAction();
  const { data, error, loading, reload } = useData('/wallet');
  const hist = useData('/wallet/settlements');
  const [settle, setSettle] = useState(null);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  const { me } = data;
  return (
    <>
      <div className="money-grid">
        <div className="col" style={{ gap: 12 }}>
          <section className="card hero">
            <div className="small">{t('dash.wallet')}</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{rupees(me.net, { sign: true })}</div>
            <div className="small">{me.net === 0 ? t('money.settled_up') : me.net > 0 ? t('dash.owed_to_you') : t('dash.you_owe')}</div>
          </section>
          {me.youOwe.length ? <section className="card"><h2>{t('dash.you_owe')}</h2><div className="list">{me.youOwe.map((o) => <div key={o.member.membershipId} className="item"><div className="grow bold">{o.member.displayName}</div><b>{rupees(o.amount)}</b><Btn size="sm" onClick={() => setSettle(o)}>{t('dash.settle_up')}</Btn></div>)}</div></section> : null}
          {me.owedToYou.length ? <section className="card"><h2>{t('dash.owed_to_you')}</h2><div className="list">{me.owedToYou.map((o) => <div key={o.member.membershipId} className="item"><div className="grow bold">{o.member.displayName}</div><b>{rupees(o.amount)}</b></div>)}</div></section> : null}
        </div>
        <div className="col" style={{ gap: 12 }}>
          <section className="card"><h2>{t('tasks.everyone')}</h2><div className="list">{data.balances.map((b) => <div key={b.member.membershipId} className="item"><div className="grow">{b.member.displayName}</div><b>{rupees(b.net, { sign: true })}</b></div>)}</div></section>
          {hist.data?.length ? <section className="card"><h2>{t('money.settle_balances')}</h2><div className="list">{hist.data.map((s) => <div key={s.id} className="item"><div className="grow small">{s.from?.displayName} paid {s.to?.displayName}<div className="muted">{shortDate(s.date, lang)}</div></div><b>{rupees(s.amount)}</b>{s.from?.membershipId === family?.myMembershipId ? <Btn size="sm" tone="ghost" onClick={() => undoRun(async () => { await del(`/wallet/settlements/${s.id}`); notifyChanged(); reload(); hist.reload(); })}>{t('common.undo')}</Btn> : null}</div>)}</div></section> : null}
        </div>
      </div>
      {settle ? <SettleForm to={settle.member} amount={settle.amount} onClose={() => setSettle(null)} onDone={() => { reload(); hist.reload(); }} /> : null}
    </>
  );
}

function MoneyContent() {
  const { t } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const grocery = useData('/grocery', { interval: 30000 });
  const unbilled = (grocery.data || []).filter((g) => g.unbilled);
  const [tab, setTab] = useState(TABS.includes(params.get('tab')) ? params.get('tab') : 'expenses');
  useEffect(() => { const q = params.get('tab'); if (TABS.includes(q)) setTab(q); }, [params]);
  const change = (next) => { setTab(next); router.replace(`/money?tab=${next}`, { scroll: false }); };
  const expensesLabel = unbilled.length ? (
    <span className="tab-label-dot">
      <span>{t('money.tab_expenses')}</span>
      <span className="tab-dot" aria-label={`${unbilled.length} unbilled`} />
    </span>
  ) : t('money.tab_expenses');
  return (
    <div className="money-page">
      <Tabs value={tab} onChange={change} items={[['expenses', expensesLabel], ['wallet', t('money.tab_wallet')], ['bills', t('nav.bills')]]} />
      <div style={{ marginTop: 12 }}>
        {tab === 'expenses' ? (
          <Expenses
            unbilled={unbilled}
            onBilled={(billedIds) => {
              if (billedIds?.length) {
                grocery.setData((prev) => (prev ? prev.map((g) => (billedIds.includes(g.id) ? { ...g, unbilled: false } : g)) : prev));
              }
            }}
          />
        ) : tab === 'wallet' ? <Wallet /> : <BillsPage embedded />}
      </div>
    </div>
  );
}

export default function MoneyPage() {
  return <Suspense fallback={<Spinner />}><MoneyContent /></Suspense>;
}
