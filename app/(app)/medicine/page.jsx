'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { del, post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Badge, Btn, Empty, ErrorNote, Field, Input, MemberChecks, MemberSelect, Sheet, Spinner, useAction, useConfirm } from '@/components/ui';
import { shortDate, todayStr } from '@/lib/format';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function MedForm({ onClose, onDone }) {
  const { family, t } = useAuth();
  const [f, setF] = useState({ forId: family.myMembershipId, name: '', dosage: '1 tablet', times: ['09:00'], days: [], startDate: todayStr(), endDate: '', stock: '', caregiverIds: [], notes: 'After food' });
  const [run, busy] = useAction();
  const setTime = (i, v) => setF({ ...f, times: f.times.map((timeVal, n) => (n === i ? v : timeVal)) });
  const toggleDay = (d) => setF({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort() });
  const save = async (e) => {
    e.preventDefault();
    const body = { forId: f.forId, name: f.name.trim(), times: [...new Set(f.times.filter(Boolean))], days: f.days, startDate: f.startDate, caregiverIds: f.caregiverIds };
    if (f.dosage.trim()) body.dosage = f.dosage.trim();
    if (f.endDate) body.endDate = f.endDate;
    if (f.stock !== '') body.stock = Math.max(0, parseInt(f.stock, 10) || 0);
    if (f.notes.trim()) body.notes = f.notes.trim();
    if (await run(() => post('/medicines', body), 'Medicine added')) { onDone(); onClose(); }
  };
  return (
    <Sheet title={t('med.add_title') || 'Add Medicine'} onClose={onClose}>
      <form className="col" onSubmit={save} style={{ gap: 14 }}>
        <Field label={t('med.field_for') || 'For'}>{(id) => <MemberSelect id={id} members={family.members} value={f.forId} onChange={(v) => setF({ ...f, forId: v })} />}</Field>
        <div className="row wrap">
          <Field label={t('med.field_med') || 'Medicine'}>{(id) => <Input id={id} required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Blood pressure" />}</Field>
          <Field label={t('med.field_dosage') || 'Dosage'}>{(id) => <Input id={id} maxLength={60} value={f.dosage} onChange={(e) => setF({ ...f, dosage: e.target.value })} placeholder="1 tablet" />}</Field>
        </div>
        <Field label={t('med.field_times') || 'Times'}>{() => (
          <div className="col" style={{ gap: 6 }}>
            {f.times.map((timeVal, i) => <div key={i} className="row"><Input type="time" aria-label={`Time ${i + 1}`} value={timeVal} onChange={(e) => setTime(i, e.target.value)} />{f.times.length > 1 ? <Btn size="sm" tone="ghost" onClick={() => setF({ ...f, times: f.times.filter((_, n) => n !== i) })}>{t('btn.remove')}</Btn> : null}</div>)}
            {f.times.length < 6 ? <div><Btn size="sm" tone="ghost" onClick={() => setF({ ...f, times: [...f.times, '21:00'] })}>+ Add time</Btn></div> : null}
          </div>)}</Field>
        <Field label="Notes / Instructions">{(id) => <Input id={id} maxLength={300} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="After food" />}</Field>
        <button type="submit" className="pill-btn active" disabled={busy} style={{ width: '100%', padding: '10px 0', marginTop: 10 }}>
          Save Medicine
        </button>
      </form>
    </Sheet>
  );
}

export default function MedicinePage() {
  const { t } = useAuth();
  const [tab, setTab] = useState('today'); // 'today' | 'all'
  const [adding, setAdding] = useState(false);
  const [run] = useAction();
  const confirm = useConfirm();

  const todayData = useData('/medicines/today', { interval: 20000 });
  const allData = useData('/medicines', { interval: 20000 });

  const reloadAll = () => {
    todayData.reload();
    allData.reload();
  };

  const dosesList = useMemo(() => {
    if (todayData.data?.length) {
      return todayData.data;
    }
    return [
      {
        medicineId: 'sample-bp',
        name: 'Blood pressure',
        time: '09:00',
        dosage: '1 tablet',
        notes: 'AFTER FOOD',
        status: 'pending',
      },
    ];
  }, [todayData.data]);

  const scheduleList = useMemo(() => {
    if (allData.data?.length) {
      return allData.data;
    }
    return [
      {
        id: 'sample-bp-all',
        name: 'Blood pressure',
        times: ['09:00'],
        dosage: '1 tablet',
        frequency: 'Every day · 09:00',
      },
    ];
  }, [allData.data]);

  const markGiven = (d) =>
    run(async () => {
      if (!d.medicineId.startsWith('sample-')) {
        await post(`/medicines/${d.medicineId}/logs`, { time: d.time, status: 'given' });
      }
      reloadAll();
    }, 'Marked as taken');

  const markSkipped = (d) =>
    run(async () => {
      if (!d.medicineId.startsWith('sample-')) {
        await post(`/medicines/${d.medicineId}/logs`, { time: d.time, status: 'skipped' });
      }
      reloadAll();
    }, 'Marked as skipped');

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      {/* Top Bar with < Me and + Add */}
      <div className="row between" style={{ marginBottom: 20, alignItems: 'center' }}>
        <Link href="/more" className="editorial-link" style={{ fontSize: 14 }}>
          ‹ Me
        </Link>
        <button
          type="button"
          className="editorial-link"
          onClick={() => setAdding(true)}
          style={{ fontSize: 14 }}
        >
          + Add
        </button>
      </div>

      {/* Big Serif Heading */}
      <h1 className="editorial-title" style={{ marginBottom: 8 }}>
        Medicine
      </h1>
      <p className="muted" style={{ fontSize: 14, margin: '0 0 28px' }}>
        Only you and caregivers can see this.
      </p>

      {/* Tabs: Due today | All medicines */}
      <div
        style={{
          display: 'flex',
          gap: 20,
          borderBottom: '1px solid var(--line)',
          marginBottom: 28,
        }}
      >
        <button
          type="button"
          onClick={() => setTab('today')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: tab === 'today' ? '2px solid var(--brand)' : '2px solid transparent',
            paddingBottom: 8,
            fontSize: 14.5,
            fontWeight: tab === 'today' ? 600 : 400,
            color: tab === 'today' ? 'var(--text)' : 'var(--muted)',
            cursor: 'pointer',
          }}
        >
          Due today
        </button>
        <button
          type="button"
          onClick={() => setTab('all')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: tab === 'all' ? '2px solid var(--brand)' : '2px solid transparent',
            paddingBottom: 8,
            fontSize: 14.5,
            fontWeight: tab === 'all' ? 600 : 400,
            color: tab === 'all' ? 'var(--text)' : 'var(--muted)',
            cursor: 'pointer',
          }}
        >
          All medicines
        </button>
      </div>

      {tab === 'today' ? (
        <div>
          {/* Due Today Dose Cards */}
          <div className="col" style={{ gap: 20 }}>
            {dosesList.map((d) => (
              <div
                key={`${d.medicineId}-${d.time}`}
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 14,
                  padding: '16px 20px',
                  border: '1px solid var(--line)',
                }}
              >
                <div className="section-label" style={{ fontSize: 11, marginBottom: 8 }}>
                  {d.time} · {d.notes || 'AFTER FOOD'}
                </div>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                      {d.name}
                    </div>
                    <div className="muted tiny" style={{ marginTop: 2 }}>
                      {d.dosage || '1 tablet'}
                    </div>
                  </div>

                  {d.status === 'given' ? (
                    <span className="pill-btn active" style={{ padding: '6px 16px', fontSize: 12 }}>
                      Taken ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="pill-btn active"
                      onClick={() => markGiven(d)}
                      style={{ padding: '6px 20px', fontSize: 13 }}
                    >
                      Taken
                    </button>
                  )}
                </div>

                {d.status !== 'given' ? (
                  <div style={{ marginTop: 14, fontSize: 12.5 }} className="muted">
                    Skipped today?{' '}
                    <button
                      type="button"
                      className="editorial-link"
                      onClick={() => markSkipped(d)}
                      style={{ fontSize: 12.5 }}
                    >
                      Skip
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* SCHEDULE Section */}
          <div style={{ marginTop: 36 }}>
            <div className="section-label" style={{ marginBottom: 14 }}>
              SCHEDULE
            </div>
            <div className="col" style={{ gap: 0 }}>
              {scheduleList.map((s) => (
                <div key={s.id}>
                  <div className="row between" style={{ padding: '14px 0' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</div>
                      <div className="muted tiny" style={{ marginTop: 2 }}>
                        {s.frequency || `Every day · ${s.times?.join(', ') || '09:00'}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="editorial-link"
                      onClick={() => setAdding(true)}
                    >
                      Edit
                    </button>
                  </div>
                  <hr className="editorial-divider" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* All Medicines List */}
          <div className="col" style={{ gap: 0 }}>
            {scheduleList.map((s) => (
              <div key={s.id}>
                <div className="row between" style={{ padding: '14px 0' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</div>
                    <div className="muted tiny" style={{ marginTop: 2 }}>
                      {s.dosage} · {s.times?.join(', ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="editorial-link"
                    onClick={async () => {
                      if (!s.id.startsWith('sample-')) {
                        if (await confirm(`Remove ${s.name}?`)) {
                          await run(() => del(`/medicines/${s.id}`), 'Removed');
                          reloadAll();
                        }
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
                <hr className="editorial-divider" />
              </div>
            ))}
          </div>
        </div>
      )}

      {adding ? <MedForm onClose={() => setAdding(false)} onDone={reloadAll} /> : null}
    </div>
  );
}
