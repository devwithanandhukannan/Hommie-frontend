'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Tabs, Spinner } from '@/components/ui';
import TasksPage from '../tasks/page';
import GroceryPage from '../grocery/page';
import MealsPage from '../meals/page';
import CalendarPage from '../calendar/page';

const TABS = ['tasks', 'grocery', 'meals', 'calendar'];

function PlannerContent() {
  const { t } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState(TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'tasks');

  useEffect(() => {
    const q = searchParams.get('tab');
    if (TABS.includes(q)) setTab(q);
  }, [searchParams]);

  const changeTab = (next) => {
    setTab(next);
    router.replace(`/planner?tab=${next}`, { scroll: false });
  };

  return (
    <div className="planner-page">
      <Tabs value={tab} onChange={changeTab} items={TABS.map((k) => [k, t(`nav.${k}`)])} />
      <div className="planner-tab-content" style={{ marginTop: 14 }}>
        {tab === 'tasks' ? <TasksPage /> : null}
        {tab === 'grocery' ? <GroceryPage /> : null}
        {tab === 'meals' ? <MealsPage /> : null}
        {tab === 'calendar' ? <CalendarPage /> : null}
      </div>
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
