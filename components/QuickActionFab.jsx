'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { post } from '@/lib/api';
import { Sheet, Btn, Field, Input, Select, MemberSelect, Icon, useAction, useToast } from '@/components/ui';
import { todayStr, toPaise } from '@/lib/format';
import AiAssistantModal from './AiAssistantModal';

const ECATS = ['grocery', 'food', 'bills', 'rent', 'tax', 'emi', 'medical', 'transport', 'shopping', 'education', 'entertainment', 'household', 'other'];

export default function QuickActionFab() {
  const pathname = usePathname();
  const { family, t, lang } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(null); // 'ai' | 'grocery' | 'task' | 'expense'
  const [run, busy] = useAction();

  // Quick Grocery Form State
  const [gName, setGName] = useState('');
  const [gQty, setGQty] = useState('');

  // Quick Task Form State
  const [tTitle, setTTitle] = useState('');
  const [tAssignee, setTAssignee] = useState(null);
  const [tDueDate, setTDueDate] = useState('');

  // Quick Expense Form State
  const [eAmount, setEAmount] = useState('');
  const [eNote, setENote] = useState('');
  const [eCategory, setECategory] = useState('other');

  // Don't show floating button on the chat page to avoid colliding with chat composer
  if (pathname === '/chat') return null;

  const saveGrocery = async (e) => {
    e.preventDefault();
    const name = gName.trim();
    if (!name) return;
    const body = { name, status: 'needed' };
    if (gQty.trim()) body.qty = gQty.trim();
    if (await run(() => post('/grocery', body), `${name} added to grocery`)) {
      setGName('');
      setGQty('');
      setSheet(null);
    }
  };

  const saveTask = async (e) => {
    e.preventDefault();
    const title = tTitle.trim();
    if (!title) return;
    const body = { title, kind: 'custom', assigneeId: tAssignee || null };
    if (tDueDate) body.dueDate = tDueDate;
    if (await run(() => post('/tasks', body), 'Task created')) {
      setTTitle('');
      setTAssignee(null);
      setTDueDate('');
      setSheet(null);
    }
  };

  const saveExpense = async (e) => {
    e.preventDefault();
    const amount = toPaise(eAmount);
    if (!amount) return;
    const body = {
      amount,
      category: eCategory,
      date: todayStr(),
      paidById: family?.myMembershipId,
      equalAmong: family?.members?.map((m) => m.membershipId) || [],
    };
    if (eNote.trim()) body.note = eNote.trim();
    if (await run(() => post('/expenses', body), 'Expense recorded')) {
      setEAmount('');
      setENote('');
      setECategory('other');
      setSheet(null);
    }
  };

  return (
    <>
      {open ? (
        <div
          className="fab-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className={`fab-container ${open ? 'open' : ''}`}>
        {open ? (
          <div className="fab-menu" role="menu">
            <button
              type="button"
              className="fab-item fab-item-ai"
              onClick={() => { setOpen(false); setSheet('ai'); }}
            >
              <span className="fab-item-icon">🎙️</span>
              <span className="fab-item-label">{lang === 'ml' ? '✨ എഐ വോയ്സ്' : '✨ AI Voice'}</span>
            </button>
            <button
              type="button"
              className="fab-item"
              onClick={() => { setOpen(false); setSheet('grocery'); }}
            >
              <span className="fab-item-icon">🛒</span>
              <span className="fab-item-label">{lang === 'ml' ? '+ പലചരക്ക്' : '+ Grocery'}</span>
            </button>
            <button
              type="button"
              className="fab-item"
              onClick={() => { setOpen(false); setSheet('task'); }}
            >
              <span className="fab-item-icon">📝</span>
              <span className="fab-item-label">{lang === 'ml' ? '+ ജോലി' : '+ Task'}</span>
            </button>
            <button
              type="button"
              className="fab-item"
              onClick={() => { setOpen(false); setSheet('expense'); }}
            >
              <span className="fab-item-icon">💸</span>
              <span className="fab-item-label">{lang === 'ml' ? '+ ചിലവ്' : '+ Expense'}</span>
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className={`fab-btn ${open ? 'active' : ''}`}
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close actions menu' : 'Quick add'}
          title="Quick Add"
        >
          <span className="fab-icon-plus">{open ? '✕' : '+'}</span>
        </button>
      </div>

      {sheet === 'ai' ? (
        <AiAssistantModal
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            toast(lang === 'ml' ? 'ലിസ്റ്റിലേക്ക് ചേർത്തു ✓' : 'Added to Hommi ✓');
          }}
        />
      ) : null}

      {sheet === 'grocery' ? (
        <Sheet
          title={lang === 'ml' ? '🛒 പലചരക്ക് സാധനം ചേർക്കുക' : '🛒 Add Grocery Item'}
          onClose={() => setSheet(null)}
        >
          <form className="col" onSubmit={saveGrocery}>
            <Field label={lang === 'ml' ? 'സാധനത്തിന്റെ പേര്' : 'Item name'}>
              {(id) => (
                <Input
                  id={id}
                  required
                  maxLength={120}
                  value={gName}
                  onChange={(e) => setGName(e.target.value)}
                  placeholder={lang === 'ml' ? 'ഉദാ: പാൽ, മുട്ട, സവാള' : 'e.g. Milk, Eggs, Onions'}
                  autoFocus
                />
              )}
            </Field>
            <Field label={lang === 'ml' ? 'അളവ് (ഓപ്ഷണൽ)' : 'Quantity (optional)'}>
              {(id) => (
                <Input
                  id={id}
                  maxLength={40}
                  value={gQty}
                  onChange={(e) => setGQty(e.target.value)}
                  placeholder="1 L, 500 g, 2 packets"
                />
              )}
            </Field>
            <Btn type="submit" disabled={busy || !gName.trim()}>
              {lang === 'ml' ? 'ചേർക്കുക' : 'Add Item'}
            </Btn>
          </form>
        </Sheet>
      ) : null}

      {sheet === 'task' ? (
        <Sheet
          title={lang === 'ml' ? '📝 പുതിയ ജോലി നൽകുക' : '📝 Add New Task'}
          onClose={() => setSheet(null)}
        >
          <form className="col" onSubmit={saveTask}>
            <Field label={lang === 'ml' ? 'എന്ത് ജോലിയാണ്?' : 'What needs to be done?'}>
              {(id) => (
                <Input
                  id={id}
                  required
                  maxLength={140}
                  value={tTitle}
                  onChange={(e) => setTTitle(e.target.value)}
                  placeholder={lang === 'ml' ? 'ഉദാ: ബാത്ത്റൂം വൃത്തിയാക്കൽ' : 'e.g. Clean the kitchen'}
                  autoFocus
                />
              )}
            </Field>
            <div className="row wrap">
              <Field label={lang === 'ml' ? 'തിയ്യതി (Due Date)' : 'Due Date'}>
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={tDueDate}
                    onChange={(e) => setTDueDate(e.target.value)}
                  />
                )}
              </Field>
              <Field label={lang === 'ml' ? 'ആർക്കാണ് ചുമതല?' : 'Assign to'}>
                {(id) => (
                  <MemberSelect
                    id={id}
                    members={family?.members || []}
                    value={tAssignee}
                    onChange={setTAssignee}
                    allowNone
                    noneLabel={lang === 'ml' ? 'ആർക്കും എടുക്കാം' : 'Anyone can take it'}
                  />
                )}
              </Field>
            </div>
            <Btn type="submit" disabled={busy || !tTitle.trim()}>
              {lang === 'ml' ? 'ചുമതലപ്പെടുത്തുക' : 'Create Task'}
            </Btn>
          </form>
        </Sheet>
      ) : null}

      {sheet === 'expense' ? (
        <Sheet
          title={lang === 'ml' ? '💸 ചിലവ് രേഖപ്പെടുത്തുക' : '💸 Record Expense'}
          onClose={() => setSheet(null)}
        >
          <form className="col" onSubmit={saveExpense}>
            <Field label={lang === 'ml' ? 'തുക (₹)' : 'Amount (₹)'}>
              {(id) => (
                <Input
                  id={id}
                  inputMode="decimal"
                  required
                  value={eAmount}
                  onChange={(e) => setEAmount(e.target.value)}
                  placeholder="150"
                  autoFocus
                />
              )}
            </Field>
            <Field label={lang === 'ml' ? 'വിവരണം' : 'Note / For what'}>
              {(id) => (
                <Input
                  id={id}
                  maxLength={150}
                  value={eNote}
                  onChange={(e) => setENote(e.target.value)}
                  placeholder={lang === 'ml' ? 'ഉദാ: മീൻ വാങ്ങി, ഓട്ടോ ചാർജ്' : 'e.g. Bought vegetables, Auto fare'}
                />
              )}
            </Field>
            <Field label={lang === 'ml' ? 'വിഭാഗം' : 'Category'}>
              {(id) => (
                <Select
                  id={id}
                  value={eCategory}
                  onChange={(e) => setECategory(e.target.value)}
                >
                  {ECATS.map((c) => (
                    <option key={c} value={c}>
                      {t(`cat.${c}`) || c}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Btn type="submit" disabled={busy || !eAmount.trim()}>
              {lang === 'ml' ? 'രേഖപ്പെടുത്തുക' : 'Save Expense'}
            </Btn>
          </form>
        </Sheet>
      ) : null}
    </>
  );
}

