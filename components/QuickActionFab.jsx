'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { post } from '@/lib/api';
import { Icon, useAction, useToast } from '@/components/ui';
import { todayStr, toPaise } from '@/lib/format';
import AiAssistantModal from './AiAssistantModal';

export default function QuickActionFab() {
  const pathname = usePathname();
  const { family, user } = useAuth();
  const toast = useToast();
  const [run, busy] = useAction();

  const [aiOpen, setAiOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('expense'); // 'task' | 'expense' | 'medicine' | 'document' | 'special-day'

  // Expense fields
  const [eAmount, setEAmount] = useState('');
  const [eCategory, setECategory] = useState('grocery');
  const [eNote, setENote] = useState('');

  // Task fields
  const [tTitle, setTTitle] = useState('');
  const [tDueDate, setTDueDate] = useState('');

  // Medicine fields
  const [mName, setMName] = useState('');
  const [mDosage, setMDosage] = useState('1 tablet');
  const [mTime, setMTime] = useState('09:00');

  // Don't show floating mic button on /chat to avoid collision
  const isChatPage = pathname === '/chat';

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
      setModalOpen(false);
      window.location.reload();
    }
  };

  const saveTask = async (e) => {
    e.preventDefault();
    if (!tTitle.trim()) return;
    const body = { title: tTitle.trim(), kind: 'task' };
    if (tDueDate) body.dueDate = tDueDate;
    if (await run(() => post('/tasks', body), 'Task created')) {
      setTTitle('');
      setTDueDate('');
      setModalOpen(false);
      window.location.reload();
    }
  };

  const saveMed = async (e) => {
    e.preventDefault();
    if (!mName.trim()) return;
    const body = {
      forId: family?.myMembershipId,
      name: mName.trim(),
      dosage: mDosage,
      times: [mTime],
      startDate: todayStr(),
    };
    if (await run(() => post('/medicines', body), 'Medicine added')) {
      setMName('');
      setModalOpen(false);
      window.location.reload();
    }
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'Anandhu';

  return (
    <>
      {/* Floating Circular Mic Button (Mobile) */}
      {!isChatPage ? (
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          className="mobile-only"
          style={{
            position: 'fixed',
            right: 18,
            bottom: 'calc(var(--nav-h) + 16px)',
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--brand)',
            color: 'var(--on-brand)',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
            zIndex: 49,
            cursor: 'pointer',
          }}
          aria-label="Ask Hommi Voice Assistant"
        >
          <Icon name="mic" size={22} />
        </button>
      ) : null}

      {/* Unified Add Modal (Image 5, Screen 5) */}
      {modalOpen ? (
        <div className="overlay" onClick={() => setModalOpen(false)}>
          <div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, borderRadius: '24px 24px 0 0', padding: '24px 24px 36px' }}
          >
            {/* Top Bar: NEW on left, Close on right */}
            <div className="row between" style={{ marginBottom: 20 }}>
              <span className="section-label" style={{ fontSize: 12 }}>
                NEW
              </span>
              <button
                type="button"
                className="editorial-link"
                style={{ fontSize: 14 }}
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>

            {/* Type selector pills: [Task] [Expense] [Medicine] [Document] [Special day] */}
            <div
              className="row wrap"
              style={{ gap: 8, marginBottom: 28 }}
            >
              {[
                ['task', 'Task'],
                ['expense', 'Expense'],
                ['medicine', 'Medicine'],
                ['document', 'Document'],
                ['special-day', 'Special day'],
              ].map(([tKey, label]) => {
                const isActive = activeTab === tKey;
                return (
                  <button
                    key={tKey}
                    type="button"
                    className={`pill-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTab(tKey)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* If Expense is active */}
            {activeTab === 'expense' ? (
              <form onSubmit={saveExpense}>
                <div className="section-label" style={{ marginBottom: 6 }}>
                  AMOUNT
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
                  <span className="font-serif" style={{ fontSize: 44, fontWeight: 400, marginRight: 2 }}>
                    ₹
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    required
                    value={eAmount}
                    onChange={(e) => setEAmount(e.target.value)}
                    placeholder="0"
                    className="font-serif"
                    style={{
                      fontSize: 44,
                      fontWeight: 400,
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      width: '100%',
                      color: eAmount ? 'var(--text)' : 'var(--muted)',
                      padding: 0,
                    }}
                  />
                </div>

                <div className="section-label" style={{ marginBottom: 8 }}>
                  CATEGORY
                </div>
                <div className="row" style={{ gap: 8, marginBottom: 20 }}>
                  {[
                    ['grocery', 'Groceries'],
                    ['bills', 'Bills'],
                    ['other', 'Other'],
                  ].map(([cKey, label]) => {
                    const isActive = eCategory === cKey;
                    return (
                      <button
                        key={cKey}
                        type="button"
                        className={`pill-btn ${isActive ? 'active' : ''}`}
                        onClick={() => setECategory(cKey)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Form fields */}
                <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginBottom: 24 }}>
                  <div className="row between" style={{ padding: '12px 0' }}>
                    <span className="muted" style={{ fontSize: 13.5 }}>Paid by</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{firstName}</span>
                  </div>
                  <hr className="editorial-divider" />
                  <div className="row between" style={{ padding: '12px 0' }}>
                    <span className="muted" style={{ fontSize: 13.5 }}>Date</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Today</span>
                  </div>
                  <hr className="editorial-divider" />
                  <div className="row between" style={{ padding: '12px 0' }}>
                    <span className="muted" style={{ fontSize: 13.5 }}>Split equally</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Everyone</span>
                  </div>
                  <hr className="editorial-divider" />
                  <div style={{ padding: '10px 0' }}>
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={eNote}
                      onChange={(e) => setENote(e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        width: '100%',
                        fontSize: 14,
                        color: 'var(--text)',
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="pill-btn active"
                  disabled={busy || !eAmount}
                  style={{ width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 600 }}
                >
                  Add expense
                </button>
              </form>
            ) : null}

            {/* If Task is active */}
            {activeTab === 'task' ? (
              <form onSubmit={saveTask}>
                <div className="section-label" style={{ marginBottom: 6 }}>
                  TASK TITLE
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Cook Chicken Mandi for lunch"
                  value={tTitle}
                  onChange={(e) => setTTitle(e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: '1.5px solid var(--brand)',
                    background: 'transparent',
                    outline: 'none',
                    padding: '8px 0',
                    fontSize: 16,
                    color: 'var(--text)',
                    marginBottom: 20,
                  }}
                />

                <div className="row between" style={{ padding: '12px 0', borderBottom: '1px solid var(--line)', marginBottom: 24 }}>
                  <span className="muted" style={{ fontSize: 13.5 }}>Due Date</span>
                  <input
                    type="date"
                    value={tDueDate}
                    onChange={(e) => setTDueDate(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5 }}
                  />
                </div>

                <button
                  type="submit"
                  className="pill-btn active"
                  disabled={busy || !tTitle.trim()}
                  style={{ width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 600 }}
                >
                  Add task
                </button>
              </form>
            ) : null}

            {/* If Medicine is active */}
            {activeTab === 'medicine' ? (
              <form onSubmit={saveMed}>
                <div className="section-label" style={{ marginBottom: 6 }}>
                  MEDICINE NAME
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Blood pressure"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: '1.5px solid var(--brand)',
                    background: 'transparent',
                    outline: 'none',
                    padding: '8px 0',
                    fontSize: 16,
                    color: 'var(--text)',
                    marginBottom: 20,
                  }}
                />

                <div className="row between" style={{ padding: '12px 0', borderBottom: '1px solid var(--line)', marginBottom: 12 }}>
                  <span className="muted" style={{ fontSize: 13.5 }}>Dosage</span>
                  <input
                    type="text"
                    value={mDosage}
                    onChange={(e) => setMDosage(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', textAlign: 'right', fontSize: 13.5 }}
                  />
                </div>

                <div className="row between" style={{ padding: '12px 0', borderBottom: '1px solid var(--line)', marginBottom: 24 }}>
                  <span className="muted" style={{ fontSize: 13.5 }}>Time</span>
                  <input
                    type="time"
                    value={mTime}
                    onChange={(e) => setMTime(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5 }}
                  />
                </div>

                <button
                  type="submit"
                  className="pill-btn active"
                  disabled={busy || !mName.trim()}
                  style={{ width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 600 }}
                >
                  Add medicine
                </button>
              </form>
            ) : null}

            {activeTab === 'document' || activeTab === 'special-day' ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p className="muted" style={{ fontSize: 14 }}>
                  Upload documents or add special days from the main menu.
                </p>
                <button
                  type="button"
                  className="pill-btn active"
                  onClick={() => setModalOpen(false)}
                >
                  Done
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Voice Assistant Modal */}
      {aiOpen ? (
        <AiAssistantModal
          onClose={() => setAiOpen(false)}
          onDone={() => setAiOpen(false)}
        />
      ) : null}
    </>
  );
}
