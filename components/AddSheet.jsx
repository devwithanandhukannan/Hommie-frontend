'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth, notifyChanged } from '@/lib/auth';
import { post } from '@/lib/api';
import { Sheet, Btn, Input, Select, MemberSelect, Icon, useAction, useToast } from '@/components/ui';
import { todayStr, toPaise } from '@/lib/format';
import AiAssistantModal from './AiAssistantModal';

const ECATS = ['grocery', 'food', 'bills', 'rent', 'tax', 'emi', 'medical', 'transport', 'shopping', 'education', 'entertainment', 'household', 'other'];
const splitList = (v) => v.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

/** One place to add anything. Every form asks for the one thing that matters and hides the rest. */
export default function AddSheet({ onClose, start = 'menu' }) {
  const { family, t } = useAuth();
  const toast = useToast();
  const [run, busy] = useAction();
  const [mode, setMode] = useState(start); // menu | ai | grocery | task | expense
  const [more, setMore] = useState(false);
  const [text, setText] = useState('');
  const [qty, setQty] = useState('');
  const [assignee, setAssignee] = useState(null);
  const [due, setDue] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');

  const done = (msg) => { notifyChanged(); toast(msg); onClose(); };

  if (mode === 'ai') return <AiAssistantModal onClose={onClose} onDone={() => done(t('btn.add'))} />;

  const saveGrocery = async (e) => {
    e.preventDefault();
    const items = splitList(text);
    if (!items.length) return;
    // Exactly what the server accepts: { name, qty? }. (The old button also sent "status", which was always rejected.)
    if (await run(async () => { for (const name of items) await post('/grocery', items.length === 1 && qty.trim() ? { name, qty: qty.trim() } : { name }); })) done(`${items.length} ✓`);
  };
  const saveTask = async (e) => {
    e.preventDefault();
    const titles = splitList(text);
    if (!titles.length) return;
    if (await run(async () => { for (const title of titles) await post('/tasks', { title, kind: 'custom', assigneeId: assignee || null, ...(due ? { dueDate: due } : {}) }); })) done(`${titles.length} ✓`);
  };
  const saveExpense = async (e) => {
    e.preventDefault();
    const paise = toPaise(amount);
    if (!paise) return;
    const body = { amount: paise, category, date: todayStr(), paidById: family?.myMembershipId, equalAmong: (family?.members || []).map((m) => m.membershipId), ...(text.trim() ? { note: text.trim() } : {}) };
    if (await run(() => post('/expenses', body))) done('✓');
  };

  const back = mode !== 'menu' && start === 'menu' ? <button type="button" className="link-btn" onClick={() => { setMode('menu'); setMore(false); }}>← {t('add.title')}</button> : null;

  return (
    <Sheet title={mode === 'menu' ? t('add.title') : t(`add.${mode}`)} onClose={onClose}>
      {mode === 'menu' ? (
        <div className="menu-card">
          <div className="menu-icons">
            <button type="button" className="menu-icon" onClick={() => setMode('grocery')}><span><Icon name="cart" size={24} /></span>{t('add.grocery')}</button>
            <button type="button" className="menu-icon" onClick={() => setMode('task')}><span><Icon name="tasks" size={24} /></span>{t('add.task')}</button>
            <button type="button" className="menu-icon" onClick={() => setMode('expense')}><span><Icon name="money" size={24} /></span>{t('add.expense')}</button>
          </div>
          <button type="button" className="menu-row" onClick={() => setMode('ai')}><span>{t('add.talk')}</span><span className="accent"><Icon name="sparkles" size={22} /></span></button>
          <Link href="/family" className="menu-row" onClick={onClose}><span>{t('menu.invite')}</span><Icon name="family" size={22} /></Link>
          <Link href="/special-days" className="menu-row" onClick={onClose}><span>{t('nav.days')}</span><Icon name="days" size={22} /></Link>
          <Link href="/medicine" className="menu-row" onClick={onClose}><span>{t('nav.medicine')}</span><Icon name="med" size={22} /></Link>
        </div>
      ) : null}

      {mode === 'grocery' ? (
        <form className="col" onSubmit={saveGrocery}>
          {back}
          <Input autoFocus required aria-label={t('add.grocery')} placeholder={t('add.grocery_ph')} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} />
          {more ? <Input aria-label="Qty" placeholder="1 L, 500 g…" value={qty} onChange={(e) => setQty(e.target.value)} maxLength={30} /> : null}
          <Btn type="submit" disabled={busy || !text.trim()}>{t('btn.add')}</Btn>
          {!more ? <button type="button" className="link-btn" onClick={() => setMore(true)}>{t('add.more')}</button> : null}
        </form>
      ) : null}

      {mode === 'task' ? (
        <form className="col" onSubmit={saveTask}>
          {back}
          <Input autoFocus required aria-label={t('add.task')} placeholder={t('add.task_ph')} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} />
          {more ? (
            <div className="col">
              <MemberSelect members={family?.members || []} value={assignee} onChange={setAssignee} allowNone noneLabel="—" aria-label="Assign" />
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
            </div>
          ) : null}
          <Btn type="submit" disabled={busy || !text.trim()}>{t('btn.add')}</Btn>
          {!more ? <button type="button" className="link-btn" onClick={() => setMore(true)}>{t('add.more')}</button> : null}
        </form>
      ) : null}

      {mode === 'expense' ? (
        <form className="col" onSubmit={saveExpense}>
          {back}
          <div className="amount-field"><span>₹</span><input autoFocus required inputMode="decimal" aria-label={t('add.amount')} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <Input aria-label={t('add.expense')} placeholder={t('add.expense_ph')} value={text} onChange={(e) => setText(e.target.value)} maxLength={150} />
          {more ? <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">{ECATS.map((c) => <option key={c} value={c}>{t(`cat.${c}`) || c}</option>)}</Select> : null}
          <Btn type="submit" disabled={busy || !toPaise(amount)}>{t('btn.add')}</Btn>
          <p className="small muted" style={{ margin: 0 }}>{more ? '' : <button type="button" className="link-btn" onClick={() => setMore(true)}>{t('add.more')}</button>}</p>
        </form>
      ) : null}
    </Sheet>
  );
}
