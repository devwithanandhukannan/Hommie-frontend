'use client';
import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useData } from '@/lib/auth';
import { post, del } from '@/lib/api';
import { Spinner, Icon, useAction } from '@/components/ui';
import TasksPage from '../tasks/page';
import MealsPage from '../meals/page';
import CalendarPage from '../calendar/page';
import AiAssistantModal from '@/components/AiAssistantModal';

function PlannerContent() {
  const { lang, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'shopping';
  const [tab, setTab] = useState(initialTab === 'grocery' ? 'shopping' : initialTab);
  const [aiOpen, setAiOpen] = useState(false);
  const [newItemInput, setNewItemInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [run] = useAction();

  // Load grocery, tasks, and meals data
  const groceryData = useData('/grocery', { interval: 20000 });
  const tasksData = useData('/tasks', { interval: 20000 });
  const dashboardData = useData('/dashboard', { interval: 30000 });

  useEffect(() => {
    const qTab = searchParams.get('tab');
    if (qTab && ['tasks', 'shopping', 'grocery', 'meals', 'calendar'].includes(qTab)) {
      setTab(qTab === 'grocery' ? 'shopping' : qTab);
    }
  }, [searchParams]);

  const changeTab = (newTab) => {
    setTab(newTab);
    router.replace(`/planner?tab=${newTab}`, { scroll: false });
  };

  // Grocery items split into needed and bought
  const allGroceryItems = groceryData.data || [];
  const neededItems = useMemo(() => {
    const list = allGroceryItems.filter((i) => i.status === 'needed');
    if (!list.length && !groceryData.loading) {
      return [
        { id: 'sample-1', name: 'Chicken', qty: '2.5 kg', status: 'needed' },
        { id: 'sample-2', name: 'Cashews and Raisins', qty: '100 g', status: 'needed' },
        { id: 'sample-3', name: 'Ghee', qty: '150 g', status: 'needed' },
        { id: 'sample-4', name: 'Green Chilli', qty: '1 pc', status: 'needed' },
        { id: 'sample-5', name: 'Tomato', qty: '1 pc', status: 'needed' },
      ];
    }
    return list;
  }, [allGroceryItems, groceryData.loading]);

  const boughtItems = useMemo(() => {
    const list = allGroceryItems.filter((i) => i.status === 'stocked' || i.status === 'bought');
    if (!list.length && !groceryData.loading) {
      return [
        { id: 'sample-b1', name: 'Basmati Rice', qty: '1.5 kg', status: 'stocked', boughtAtText: 'You, 10 min ago' },
      ];
    }
    return list;
  }, [allGroceryItems, groceryData.loading]);

  // Add new grocery item
  const handleAddItem = async (e) => {
    e.preventDefault();
    const trimmed = newItemInput.trim();
    if (!trimmed) return;

    // Parse simple quantity like "milk 2 L" or "Chicken 2.5 kg"
    const match = trimmed.match(/^(.*?)(?:\s+(\d+(?:\.\d+)?\s*(?:kg|g|L|ml|pcs|pc|pack|box|doz|bottle|bunch)?))?$/i);
    const itemName = (match ? match[1] : trimmed).trim();
    const itemQty = match && match[2] ? match[2].trim() : '';

    if (await run(() => post('/grocery', { name: itemName || trimmed, qty: itemQty, status: 'needed' }), 'Added item')) {
      setNewItemInput('');
      setIsAdding(false);
      groceryData.reload();
    }
  };

  const markBought = (item) =>
    run(async () => {
      if (!item.id.startsWith('sample-')) {
        await post(`/grocery/${item.id}/bought`, {});
      }
      groceryData.reload();
    }, `Marked ${item.name} as bought`);

  const markNeeded = (item) =>
    run(async () => {
      if (!item.id.startsWith('sample-')) {
        await post(`/grocery/${item.id}/need`, {});
      }
      groceryData.reload();
    }, `Moved ${item.name} back to shopping`);

  // Side context data (This week)
  const thisWeekTasks = useMemo(() => {
    if (tasksData.data?.length) {
      return tasksData.data.slice(0, 3);
    }
    return [
      { id: 't1', title: 'Cook Chicken Mandi for lunch', dueDate: 'Due 8 Nov' },
    ];
  }, [tasksData.data]);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Anandhu';

  return (
    <div className="planner-editorial-page">
      {/* Subtitle: PLAN */}
      <div className="section-label" style={{ marginBottom: 12 }}>
        PLAN
      </div>

      {/* Editorial Horizontal Underline Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          borderBottom: '1px solid var(--line)',
          marginBottom: 36,
          paddingBottom: 0,
        }}
      >
        {[
          ['tasks', 'Tasks'],
          ['shopping', 'Shopping'],
          ['meals', 'Meals'],
          ['calendar', 'Calendar'],
        ].map(([key, label]) => {
          const isActive = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => changeTab(key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--brand)' : '2px solid transparent',
                padding: '0 0 10px 0',
                fontSize: 15,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text)' : 'var(--muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'shopping' ? (
        <div className="editorial-layout">
          {/* Center Column: 7 to buy & Items List */}
          <div className="editorial-col-center">
            {/* Big Serif Heading: "7 to buy." */}
            <h1 className="editorial-title" style={{ marginBottom: 28 }}>
              {neededItems.length} to buy.
            </h1>

            {/* "+ Add an item, e.g. milk 2 L" */}
            <form onSubmit={handleAddItem} style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1.5px solid var(--brand)',
                  paddingBottom: 8,
                }}
              >
                <input
                  type="text"
                  value={newItemInput}
                  onChange={(e) => setNewItemInput(e.target.value)}
                  placeholder="+ Add an item, e.g. milk 2 L"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: 15,
                    width: '100%',
                    color: 'var(--text)',
                    padding: 0,
                  }}
                />
                {newItemInput ? (
                  <button
                    type="submit"
                    className="pill-btn active"
                    style={{ padding: '4px 14px', fontSize: 12, marginLeft: 8 }}
                  >
                    Add
                  </button>
                ) : null}
              </div>
            </form>

            {/* Needed Items List */}
            <div className="col" style={{ gap: 0 }}>
              {neededItems.map((item) => (
                <div key={item.id}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 0',
                      gap: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <button
                        type="button"
                        className="round-checkbox"
                        onClick={() => markBought(item)}
                        aria-label={`Mark ${item.name} as bought`}
                      />
                      <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)' }}>
                        {item.name}
                      </span>
                    </div>
                    {item.qty ? (
                      <span className="muted" style={{ fontSize: 14 }}>
                        {item.qty}
                      </span>
                    ) : null}
                  </div>
                  <hr className="editorial-divider" />
                </div>
              ))}
            </div>

            {/* BOUGHT Section */}
            {boughtItems.length > 0 ? (
              <div style={{ marginTop: 36 }}>
                <div className="section-label" style={{ marginBottom: 16 }}>
                  BOUGHT · {boughtItems.length}
                </div>
                <div className="col" style={{ gap: 0 }}>
                  {boughtItems.map((item) => (
                    <div key={item.id}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 0',
                          gap: 16,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <button
                            type="button"
                            className="round-checkbox checked"
                            onClick={() => markNeeded(item)}
                            aria-label={`Move ${item.name} back to buy`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 500, textDecoration: 'line-through', color: 'var(--muted)' }}>
                              {item.name}
                            </div>
                            <div className="tiny muted" style={{ marginTop: 2 }}>
                              {item.boughtAtText || 'You, just now'}
                            </div>
                          </div>
                        </div>
                        {item.qty ? (
                          <span className="muted" style={{ fontSize: 14 }}>
                            {item.qty}
                          </span>
                        ) : null}
                      </div>
                      <hr className="editorial-divider" />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Right Column: "This week." with Tasks & Meals */}
          <div className="editorial-col-right">
            <h2 className="editorial-h2" style={{ fontSize: 32, margin: '0 0 24px' }}>
              This week.
            </h2>

            {/* Tasks section */}
            <div>
              <div className="section-label" style={{ marginBottom: 12 }}>
                TASKS
              </div>
              <div className="col" style={{ gap: 0 }}>
                {thisWeekTasks.map((t) => (
                  <div key={t.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                      <button
                        type="button"
                        className="round-checkbox"
                        aria-label={`Task ${t.title}`}
                      />
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>
                          {t.title}
                        </div>
                        <div className="muted tiny" style={{ marginTop: 2 }}>
                          {t.dueDate || 'Due 8 Nov'}
                        </div>
                      </div>
                    </div>
                    <hr className="editorial-divider" />
                  </div>
                ))}
              </div>
              <div className="row between" style={{ padding: '12px 0', fontSize: 13.5 }}>
                <span className="muted">Done · 4</span>
                <button type="button" className="editorial-link">
                  Show
                </button>
              </div>
            </div>

            <hr className="editorial-divider" style={{ margin: '8px 0' }} />

            {/* Meals section */}
            <div>
              <div className="section-label" style={{ marginBottom: 12 }}>
                MEALS
              </div>
              <div className="col" style={{ gap: 16 }}>
                <div>
                  <div className="muted tiny" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Today · Dinner
                  </div>
                  <div className="row between" style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>Nothing planned</span>
                    <Link href="/planner?tab=meals" className="editorial-link">
                      Plan
                    </Link>
                  </div>
                </div>

                <div>
                  <div className="muted tiny" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Sun 8 · Lunch
                  </div>
                  <div className="row between" style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>Chicken Mandi</span>
                    <Link href="/planner?tab=meals" className="editorial-link">
                      Edit
                    </Link>
                  </div>
                  <div className="muted tiny" style={{ marginTop: 2 }}>
                    Cook: {firstName}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'tasks' ? <TasksPage /> : null}
      {tab === 'meals' ? <MealsPage /> : null}
      {tab === 'calendar' ? <CalendarPage /> : null}

      {aiOpen ? (
        <AiAssistantModal
          onClose={() => setAiOpen(false)}
          onDone={() => setAiOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default function PlannerPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PlannerContent />
    </Suspense>
  );
}

