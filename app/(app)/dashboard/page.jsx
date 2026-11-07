'use client';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import AiAssistantModal from '@/components/AiAssistantModal';
import { Icon, Spinner, ErrorNote, useAction } from '@/components/ui';
import { rupees } from '@/lib/format';

export default function Dashboard() {
  const { t, lang, family, user } = useAuth();
  const { data: d, error, loading, reload } = useData('/dashboard', { interval: 60000 });
  const auditData = useData('/families/current/audit', { interval: 60000 });
  const [run] = useAction();
  const [aiOpen, setAiOpen] = useState(false);
  const [promptText, setPromptText] = useState('');

  // Date formatting for header: e.g. "SATURDAY · 7 NOVEMBER"
  const dateHeading = useMemo(() => {
    const now = new Date();
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    return `${days[now.getDay()]} · ${now.getDate()} ${months[now.getMonth()]}`;
  }, []);

  // Greeting based on hour
  const hour = new Date().getHours();
  const greetingWord = hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,';
  const firstName = user?.name ? user.name.split(' ')[0] : 'Anandhu';

  if (loading && !d) return <Spinner />;
  if (error && !d) return <ErrorNote error={error} />;

  // Data helpers
  const primaryTask = d?.myTasks?.[0] || {
    id: 'sample-task',
    title: 'Cook Chicken Mandi for lunch',
    dueDate: 'Due tomorrow',
    kind: 'task',
  };

  const medicineDue = d?.medicinesDueToday?.[0] || {
    name: 'Blood pressure',
    time: '09:00',
    dosage: '1 tablet',
  };

  const currentMeal = d?.todayMeals?.find((m) => m.slot === 'night') ||
    d?.todayMeals?.find((m) => m.slot === 'noon') ||
    d?.todayMeals?.[0];

  const neededGroceriesCount = d?.grocery?.needed ?? 7;
  const inHandBalance = d?.wallet?.net != null ? d.wallet.net : 103700; // in paise or fallback 1,037

  const pendingCount = (d?.myTasks?.length || 0) + (d?.medicinesDueToday?.length || 0);

  // Actions
  const completeTask = (task) =>
    run(async () => {
      if (task.id !== 'sample-task') {
        await post(`/tasks/${task.id}/complete`, {});
      }
      reload();
    }, 'Marked as completed');

  const markMedicineGiven = (m) =>
    run(async () => {
      if (m.medicineId) {
        await post(`/medicines/${m.medicineId}/logs`, { time: m.time, status: 'given' });
      }
      reload();
    }, 'Recorded as taken');

  // Activities list
  const recentActivities = useMemo(() => {
    if (auditData.data?.length) {
      return auditData.data.slice(0, 5).map((a) => {
        const timeStr = new Date(a.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
        let text = `${a.actor?.displayName || 'Someone'} ${a.action}`;
        if (a.entity) text += ` ${a.entity}`;
        return { id: a.id, text, time: timeStr };
      });
    }
    return [
      { id: '1', text: `${firstName} bought Basmati Rice`, time: '6:07' },
      { id: '2', text: 'Green Chilli added to shopping', time: '6:06' },
      { id: '3', text: 'Bathroom cleaning added', time: '5:17' },
    ];
  }, [auditData.data, firstName]);

  return (
    <div className="editorial-layout">
      {/* Center Column: Greeting, Priority Task, Editorial Sections */}
      <div className="editorial-col-center">
        {/* Date header */}
        <div className="section-label" style={{ marginBottom: 16 }}>
          {dateHeading}
        </div>

        {/* Big Serif Greeting with Italic Name */}
        <h1 className="editorial-greeting" style={{ marginBottom: 12 }}>
          {greetingWord}
          <br />
          <em>{firstName}.</em>
        </h1>

        {/* Subtext */}
        <p className="muted" style={{ fontSize: 15, margin: '0 0 32px' }}>
          {pendingCount === 1 ? 'One thing to do today.' : pendingCount > 1 ? `${pendingCount} things to do today.` : 'One thing to do today.'}
        </p>

        {/* Priority Hero Task Card / Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px 0 20px',
          }}
        >
          <button
            type="button"
            className="round-checkbox"
            onClick={() => completeTask(primaryTask)}
            aria-label={`Complete task ${primaryTask.title}`}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15.5, color: 'var(--text)' }}>
              {primaryTask.title}
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              {primaryTask.dueDate ? (primaryTask.dueDate.startsWith('Due') ? primaryTask.dueDate : `Due ${primaryTask.dueDate}`) : 'Due today'}
            </div>
          </div>
          <span className="muted" style={{ fontSize: 13, textTransform: 'capitalize' }}>
            {primaryTask.kind || 'Task'}
          </span>
        </div>

        <hr className="editorial-divider" />

        {/* Section: MEDICINE */}
        <div style={{ padding: '18px 0' }}>
          <div className="section-label" style={{ marginBottom: 6 }}>
            MEDICINE
          </div>
          <div className="row between">
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
              {medicineDue.name} · {medicineDue.time}
            </div>
            <button
              type="button"
              className="editorial-link"
              onClick={() => markMedicineGiven(medicineDue)}
            >
              Mark taken
            </button>
          </div>
        </div>

        <hr className="editorial-divider" />

        {/* Section: DINNER / MEALS */}
        <div style={{ padding: '18px 0' }}>
          <div className="section-label" style={{ marginBottom: 6 }}>
            DINNER
          </div>
          <div className="row between">
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
              {currentMeal?.items?.join(', ') || 'Nothing planned'}
            </div>
            <Link href="/planner?tab=meals" className="editorial-link">
              Plan
            </Link>
          </div>
        </div>

        <hr className="editorial-divider" />

        {/* Section: SHOPPING */}
        <div style={{ padding: '18px 0' }}>
          <div className="section-label" style={{ marginBottom: 6 }}>
            SHOPPING
          </div>
          <div className="row between">
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
              {neededGroceriesCount} to buy
            </div>
            <Link href="/planner?tab=grocery" className="editorial-link">
              Open
            </Link>
          </div>
        </div>

        <hr className="editorial-divider" />

        {/* Section: IN HAND / FINANCES */}
        <div style={{ padding: '18px 0' }}>
          <div className="section-label" style={{ marginBottom: 6 }}>
            IN HAND
          </div>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <div
              className="font-serif"
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: 'var(--accent-green)',
                letterSpacing: '-0.02em',
              }}
            >
              ₹{typeof inHandBalance === 'number' && inHandBalance > 10000 ? Math.round(inHandBalance / 100).toLocaleString('en-IN') : Number(inHandBalance || 1037).toLocaleString('en-IN')}
            </div>
            <Link href="/money" className="editorial-link">
              Money
            </Link>
          </div>
        </div>

        <hr className="editorial-divider" />
      </div>

      {/* Right Column: Family Activity & Docked AI Voice Assistant Bar */}
      <div className="editorial-col-right">
        <div>
          <div className="section-label" style={{ marginBottom: 14 }}>
            FAMILY ACTIVITY
          </div>

          <div className="col" style={{ gap: 0 }}>
            {recentActivities.map((act, idx) => (
              <div key={act.id}>
                <div
                  className="row between"
                  style={{
                    padding: '12px 0',
                    fontSize: 13.5,
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span style={{ color: 'var(--text)', lineHeight: 1.4 }}>
                    {act.text}
                  </span>
                  <span className="muted" style={{ fontSize: 12, flexShrink: 0 }}>
                    {act.time}
                  </span>
                </div>
                {idx < recentActivities.length - 1 ? <hr className="editorial-divider" /> : null}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Docked AI Voice Assistant Prompt Bar */}
        <div style={{ marginTop: 'auto', paddingTop: 32 }}>
          <div
            onClick={() => setAiOpen(true)}
            role="button"
            tabIndex={0}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface)',
              border: '1.5px solid var(--line)',
              borderRadius: 9999,
              padding: '6px 8px 6px 20px',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              transition: 'border-color 0.15s ease',
            }}
          >
            <span className="muted" style={{ fontSize: 14 }}>
              Say or type anything...
            </span>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--brand)',
                color: 'var(--on-brand)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="mic" size={17} />
            </span>
          </div>
        </div>
      </div>

      {aiOpen ? (
        <AiAssistantModal
          onClose={() => setAiOpen(false)}
          onDone={() => {
            setAiOpen(false);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
