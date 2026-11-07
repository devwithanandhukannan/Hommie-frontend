'use client';
import { useState, useMemo } from 'react';
import { del, post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Spinner, ErrorNote, Sheet, Field, Input, Select, MemberSelect, MemberChecks, Btn, useAction, useConfirm } from '@/components/ui';
import { rupees, shortDate, todayStr, toPaise } from '@/lib/format';

const thisMonth = () => todayStr().slice(0, 7);

export default function MoneyPage() {
  const { family, t, user } = useAuth();
  const [month, setMonth] = useState(thisMonth());
  const [modalView, setModalView] = useState(null); // 'wallet' | 'loans' | 'tax'

  // Form state for inline "ADD EXPENSE" on desktop & modal
  const [addAmount, setAddAmount] = useState('');
  const [addCategory, setAddCategory] = useState('grocery');
  const [addNote, setAddNote] = useState('');
  const [paidById, setPaidById] = useState(family?.myMembershipId);
  const [splitAll, setSplitAll] = useState(true);

  const [run, busy] = useAction();
  const confirm = useConfirm();

  const rep = useData(`/reports/monthly?month=${month}`, { deps: [month] });
  const list = useData(`/expenses?month=${month}`, { deps: [month] });
  const walletData = useData('/wallet');

  const reloadAll = () => {
    rep.reload();
    list.reload();
    walletData.reload();
  };

  // Month formatted header: e.g. "MONEY · NOVEMBER 2026"
  const monthHeading = useMemo(() => {
    const [y, m] = month.split('-');
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
    const mName = date.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }).toUpperCase();
    return `MONEY · ${mName} ${y}`;
  }, [month]);

  // Expenses data fallback
  const totalSpent = rep.data?.total != null ? Math.round(rep.data.total / 100) : 2194;
  const billsTotal = rep.data?.byCategory?.find((c) => c.category === 'bills')?.total != null
    ? Math.round(rep.data.byCategory.find((c) => c.category === 'bills').total / 100)
    : 1300;
  const groceriesTotal = rep.data?.byCategory?.find((c) => c.category === 'grocery')?.total != null
    ? Math.round(rep.data.byCategory.find((c) => c.category === 'grocery').total / 100)
    : 894;

  const totalCalculated = Math.max(1, billsTotal + groceriesTotal);
  const billsPercent = Math.round((billsTotal / totalCalculated) * 100);
  const groceriesPercent = 100 - billsPercent;

  // Recent expenses list
  const expensesList = useMemo(() => {
    if (list.data?.length) {
      return list.data.map((e) => {
        const amt = Math.round(e.amount / 100);
        const isAnomaly = amt >= 700 && e.category === 'grocery';
        return {
          id: e.id,
          name: e.note || (e.category === 'bills' ? 'Current bill' : 'Groceries'),
          amount: amt,
          category: e.category === 'bills' ? 'Bills' : 'Groceries',
          date: shortDate(e.date),
          anomaly: isAnomaly ? 'Looks high. Check?' : null,
        };
      });
    }
    return [
      { id: '1', name: 'Basmati Rice', amount: 120, category: 'Groceries', date: '7 Nov', anomaly: null },
      { id: '2', name: 'Egg', amount: 700, category: 'Groceries', date: '6 Nov', anomaly: 'Looks high. Check?' },
      { id: '3', name: 'Egg', amount: 70, category: 'Groceries', date: '6 Nov', anomaly: null },
      { id: '4', name: 'Current bill', amount: 1300, category: 'Bills', date: '6 Nov', anomaly: null },
    ];
  }, [list.data]);

  // Handle Add Expense
  const handleAddExpense = async (e) => {
    if (e) e.preventDefault();
    const cleanAmount = toPaise(addAmount);
    if (!cleanAmount) return;

    const allMembers = family?.members?.map((m) => m.membershipId) || [];
    const body = {
      amount: cleanAmount,
      category: addCategory,
      date: todayStr(),
      paidById: paidById || family?.myMembershipId,
      equalAmong: allMembers,
    };
    if (addNote.trim()) body.note = addNote.trim();

    if (await run(() => post('/expenses', body), 'Expense recorded')) {
      setAddAmount('');
      setAddNote('');
      reloadAll();
    }
  };

  const firstName = user?.name ? user.name.split(' ')[0] : 'Anandhu';

  return (
    <div className="money-editorial-page">
      {/* Header Bar */}
      <div className="row between" style={{ marginBottom: 12, alignItems: 'center' }}>
        <div className="section-label">{monthHeading}</div>
        <div className="row" style={{ gap: 8, fontSize: 13.5 }}>
          <button
            type="button"
            className="editorial-link"
            onClick={() => setModalView('wallet')}
          >
            Wallet
          </button>
          <span className="muted">·</span>
          <button
            type="button"
            className="editorial-link"
            onClick={() => setModalView('loans')}
          >
            Loans
          </button>
          <span className="muted">·</span>
          <button
            type="button"
            className="editorial-link"
            onClick={() => setModalView('tax')}
          >
            Tax
          </button>
        </div>
      </div>

      <div className="editorial-layout" style={{ marginTop: 24 }}>
        {/* Center Column: Total spent, Progress bar, Latest */}
        <div className="editorial-col-center">
          {/* Big Serif Amount: ₹2,194 */}
          <div className="font-serif" style={{ fontSize: 56, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1 }}>
            ₹{totalSpent.toLocaleString('en-IN')}
          </div>
          <div className="muted" style={{ fontSize: 15, margin: '8px 0 28px' }}>
            spent this month
          </div>

          {/* Segmented Dual-Color Progress Bar */}
          <div
            style={{
              height: 7,
              borderRadius: 4,
              overflow: 'hidden',
              display: 'flex',
              background: 'var(--line)',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: `${billsPercent}%`,
                background: 'var(--brand)',
                transition: 'width 0.3s ease',
              }}
            />
            <div
              style={{
                width: `${groceriesPercent}%`,
                background: 'var(--accent-terracotta)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {/* Legend */}
          <div className="row" style={{ gap: 20, fontSize: 13, fontWeight: 500, marginBottom: 36 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand)' }} />
              <span>Bills ₹{billsTotal.toLocaleString('en-IN')}</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-terracotta)' }} />
              <span style={{ color: 'var(--accent-terracotta)' }}>Groceries ₹{groceriesTotal.toLocaleString('en-IN')}</span>
            </span>
          </div>

          {/* Section: LATEST */}
          <div>
            <div className="section-label" style={{ marginBottom: 16 }}>
              LATEST
            </div>

            <div className="col" style={{ gap: 0 }}>
              {expensesList.map((item) => (
                <div key={item.id}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      padding: '14px 0',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                        {item.name}
                      </div>
                      <div className="muted tiny" style={{ marginTop: 2 }}>
                        {item.date} · {item.category}
                      </div>
                      {item.anomaly ? (
                        <div
                          style={{
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: 'var(--accent-terracotta)',
                            fontStyle: 'italic',
                            marginTop: 3,
                          }}
                        >
                          {item.anomaly}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)' }}>
                      ₹{item.amount.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <hr className="editorial-divider" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: ADD EXPENSE & WHO PAID */}
        <div className="editorial-col-right">
          <form onSubmit={handleAddExpense}>
            <div className="section-label" style={{ marginBottom: 14 }}>
              ADD EXPENSE
            </div>

            {/* Display: ₹ 0 (Large Serif) */}
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
              <span className="font-serif" style={{ fontSize: 44, fontWeight: 400, marginRight: 2 }}>
                ₹
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                placeholder="0"
                className="font-serif"
                style={{
                  fontSize: 44,
                  fontWeight: 400,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  width: '100%',
                  color: addAmount ? 'var(--text)' : 'var(--muted)',
                  padding: 0,
                }}
              />
            </div>

            {/* Category Pills: [Groceries] [Bills] [Other] */}
            <div className="row" style={{ gap: 8, marginBottom: 20 }}>
              {[
                ['grocery', 'Groceries'],
                ['bills', 'Bills'],
                ['other', 'Other'],
              ].map(([cat, label]) => {
                const isActive = addCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`pill-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setAddCategory(cat)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Details Rows with Dividers */}
            <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginBottom: 20 }}>
              <div className="row between" style={{ padding: '12px 0' }}>
                <span className="muted" style={{ fontSize: 13.5 }}>
                  Paid by
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {firstName}
                </span>
              </div>
              <hr className="editorial-divider" />
              <div className="row between" style={{ padding: '12px 0' }}>
                <span className="muted" style={{ fontSize: 13.5 }}>
                  Split equally
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  Everyone
                </span>
              </div>
            </div>

            {/* Add Expense Black Pill Button */}
            <button
              type="submit"
              className="pill-btn active"
              disabled={busy || !addAmount}
              style={{
                width: '100%',
                padding: '11px 0',
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 36,
              }}
            >
              Add expense
            </button>
          </form>

          {/* Section: WHO PAID */}
          <div>
            <div className="section-label" style={{ marginBottom: 14 }}>
              WHO PAID
            </div>
            <div className="row between" style={{ padding: '8px 0' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{firstName}</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>₹{totalSpent.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet / Loans / Tax Sheets */}
      {modalView === 'wallet' ? (
        <Sheet title="Family Wallet & Settle Up" onClose={() => setModalView(null)}>
          <div className="col" style={{ gap: 16 }}>
            <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 12 }}>
              <div className="muted small">Net Family Balance</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-green)' }}>
                {walletData.data?.me ? rupees(walletData.data.me.net, { sign: true }) : '₹1,037'}
              </div>
            </div>
            {walletData.data?.balances?.map((b) => (
              <div key={b.member.membershipId} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span>{b.member.displayName}</span>
                <b>{rupees(b.net, { sign: true })}</b>
              </div>
            ))}
          </div>
        </Sheet>
      ) : null}

      {modalView === 'loans' ? (
        <Sheet title="Loans & EMIs" onClose={() => setModalView(null)}>
          <p className="muted small">Track home loans, car loans, personal loans and recurring EMIs.</p>
          <div className="card" style={{ padding: 14 }}>
            <div className="bold">Home Loan</div>
            <div className="muted small">SBI · ₹24,500/mo due on 5th</div>
          </div>
        </Sheet>
      ) : null}

      {modalView === 'tax' ? (
        <Sheet title="Tax & Section 80C Documents" onClose={() => setModalView(null)}>
          <p className="muted small">Organize annual tax receipts, health insurance, and 80C deductions.</p>
          <div className="card" style={{ padding: 14 }}>
            <div className="bold">Financial Year 2026-27</div>
            <div className="muted small">Eligible deductions: ₹1,50,000 / ₹1,50,000</div>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
