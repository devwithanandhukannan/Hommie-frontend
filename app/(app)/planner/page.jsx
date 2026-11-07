'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Tabs, Spinner, Icon } from '@/components/ui';
import TasksPage from '../tasks/page';
import GroceryPage from '../grocery/page';
import MealsPage from '../meals/page';
import CalendarPage from '../calendar/page';
import AiAssistantModal from '@/components/AiAssistantModal';

function PlannerContent() {
  const { lang } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'tasks';
  const [tab, setTab] = useState(initialTab);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    const qTab = searchParams.get('tab');
    if (qTab && ['tasks', 'grocery', 'meals', 'calendar'].includes(qTab)) {
      setTab(qTab);
    }
  }, [searchParams]);

  const changeTab = (newTab) => {
    setTab(newTab);
    router.replace(`/planner?tab=${newTab}`, { scroll: false });
  };

  const tabItems = [
    ['tasks', lang === 'ml' ? 'ജോലികൾ' : 'Tasks'],
    ['grocery', lang === 'ml' ? 'പലചരക്ക്' : 'Grocery'],
    ['meals', lang === 'ml' ? 'ഭക്ഷണം' : 'Meals'],
    ['calendar', lang === 'ml' ? 'കലണ്ടർ' : 'Calendar'],
  ];

  return (
    <div className="planner-page">
      <div className="row between wrap" style={{ marginBottom: 12, gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="tasks" size={22} />
            <span>{lang === 'ml' ? 'കുടുംബ പ്ലാനർ' : 'Family Planner'}</span>
          </h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {lang === 'ml'
              ? 'ജോലികൾ, പലചരക്ക്, ഭക്ഷണം, കലണ്ടർ ഒരൊറ്റ സ്ഥലത്ത്'
              : 'Tasks, groceries, meals, and calendar all in one place'}
          </p>
        </div>
        <button
          type="button"
          className="btn light sm"
          onClick={() => setAiOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '6px 14px', fontWeight: 600, color: 'var(--brand)' }}
          title={lang === 'ml' ? 'എഐ വോയ്സ് അസിസ്റ്റന്റ്' : 'AI Voice Assistant'}
        >
          <Icon name="sparkles" size={16} />
          <span>{lang === 'ml' ? 'എഐ വോയ്സ്' : 'AI Voice'}</span>
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Tabs value={tab} onChange={changeTab} items={tabItems} />
      </div>

      <div className="planner-tab-content">
        {tab === 'tasks' ? <TasksPage /> : null}
        {tab === 'grocery' ? <GroceryPage /> : null}
        {tab === 'meals' ? <MealsPage /> : null}
        {tab === 'calendar' ? <CalendarPage /> : null}
      </div>

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

