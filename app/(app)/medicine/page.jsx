'use client';
import { useState } from 'react';
import { del, post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Badge, Btn, Empty, ErrorNote, Field, Input, MemberChecks, MemberSelect, PageHeader, Sheet, Spinner, Tabs, useAction, useConfirm } from '@/components/ui';
import { shortDate, todayStr } from '@/lib/format';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function MedForm({ onClose, onDone }) {
  const { family, t } = useAuth();
  const [f, setF] = useState({ forId: family.myMembershipId, name: '', dosage: '', times: ['09:00'], days: [], startDate: todayStr(), endDate: '', stock: '', caregiverIds: [], notes: '' });
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
    <Sheet title={t('med.add_title')} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <Field label={t('med.field_for')}>{(id) => <MemberSelect id={id} members={family.members} value={f.forId} onChange={(v) => setF({ ...f, forId: v })} />}</Field>
        <div className="row wrap">
          <Field label={t('med.field_med')}>{(id) => <Input id={id} required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="BP tablet" />}</Field>
          <Field label={t('med.field_dosage')}>{(id) => <Input id={id} maxLength={60} value={f.dosage} onChange={(e) => setF({ ...f, dosage: e.target.value })} placeholder="1 tablet" />}</Field>
        </div>
        <Field label={t('med.field_times')}>{() => (
          <div className="col" style={{ gap: 6 }}>
            {f.times.map((timeVal, i) => <div key={i} className="row"><Input type="time" aria-label={`Time ${i + 1}`} value={timeVal} onChange={(e) => setTime(i, e.target.value)} />{f.times.length > 1 ? <Btn size="sm" tone="ghost" onClick={() => setF({ ...f, times: f.times.filter((_, n) => n !== i) })}>{t('btn.remove')}</Btn> : null}</div>)}
            {f.times.length < 6 ? <div><Btn size="sm" tone="ghost" onClick={() => setF({ ...f, times: [...f.times, '21:00'] })}>+ {t('btn.add')}</Btn></div> : null}
          </div>)}</Field>
        <Field label={t('med.field_days')} hint="Leave all unchecked for every day">{() => <div className="row wrap">{DAYS.map((d, i) => <label key={d} className="check"><input type="checkbox" checked={f.days.includes(i)} onChange={() => toggleDay(i)} />{d}</label>)}</div>}</Field>
        <div className="row wrap">
          <Field label={t('med.field_start')}>{(id) => <Input id={id} type="date" required value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />}</Field>
          <Field label={t('med.field_end')}>{(id) => <Input id={id} type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />}</Field>
          <Field label={t('med.field_tablets_left')}>{(id) => <Input id={id} type="number" min={0} style={{ width: 90 }} value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />}</Field>
        </div>
        <Field label={t('med.field_caregivers')} hint="Medicine is visible only to the person, caregivers and you.">{() => <MemberChecks members={family.members.filter((m) => m.membershipId !== f.forId)} value={f.caregiverIds} onChange={(v) => setF({ ...f, caregiverIds: v })} />}</Field>
        <Field label={t('med.field_notes')}>{(id) => <Input id={id} maxLength={300} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="After food" />}</Field>
        <Btn type="submit" disabled={busy}>{t('btn.save')}</Btn>
      </form>
    </Sheet>
  );
}

function Today() {
  const { t } = useAuth();
  const { data, error, loading, reload } = useData('/medicines/today', { interval: 180000 });
  const [run] = useAction();
  const log = (d, status) => run(async () => { await post(`/medicines/${d.medicineId}/logs`, { time: d.time, status }); reload(); }, status === 'given' ? 'Recorded' : 'Skipped');
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  if (!data.length) return <Empty>{t('med.no_doses_today')}</Empty>;
  return (
    <div className="card list">
      {data.map((d) => (
        <div key={`${d.medicineId}${d.time}`} className="item">
          <div className="grow"><div className="bold">{d.forMember?.displayName} · {d.name}</div><div className="small muted">{d.time}{d.dosage ? ` · ${d.dosage}` : ''}</div></div>
          {d.status === 'given' ? <Badge tone="ok">{t('med.given')}</Badge> : d.status === 'skipped' ? <Badge>{t('med.skipped')}</Badge> : <>
            {d.status === 'missed' ? <Badge tone="danger">{t('med.missed')}</Badge> : null}
            <Btn size="sm" onClick={() => log(d, 'given')}>{t('med.given')}</Btn><Btn size="sm" tone="ghost" onClick={() => log(d, 'skipped')}>{t('med.skip')}</Btn></>}
        </div>
      ))}
    </div>
  );
}

function All() {
  const { t, lang } = useAuth();
  const { data, error, loading, reload } = useData('/medicines');
  const [run] = useAction();
  const confirm = useConfirm();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  if (!data.length) return <Empty>{t('med.no_medicines')}</Empty>;
  return (
    <div className="card list">
      {data.map((m) => (
        <div key={m.id} className="item">
          <div className="grow"><div className="bold">{m.forMember?.displayName} · {m.name}</div><div className="small muted">{m.times.join(', ')}{m.dosage ? ` · ${m.dosage}` : ''}{m.endDate ? ` · until ${shortDate(m.endDate, lang)}` : ''}{m.notes ? ` · ${m.notes}` : ''}</div></div>
          {m.lowStock ? <Badge tone="warn">{m.stock} {t('grocery.low')}</Badge> : null}
          <Btn size="sm" tone="ghost" onClick={async () => { const msg = 'Remove ' + m.name + '?'; if (await confirm(msg)) run(async () => { await del(`/medicines/${m.id}`); reload(); }, 'Removed'); }}>{t('btn.remove')}</Btn>
        </div>
      ))}
    </div>
  );
}

export default function MedicinePage() {
  const { t } = useAuth();
  const [tab, setTab] = useState('today');
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState(0);
  return (
    <>
      <PageHeader title={t('med.title')} sub={t('med.sub')}><Btn onClick={() => setAdding(true)}>{t('med.add_btn')}</Btn></PageHeader>
      <Tabs value={tab} onChange={setTab} items={[['today', t('med.tab_today')], ['all', t('med.tab_all')]]} />
      <div style={{ marginTop: 12 }} key={`${tab}${n}`}>{tab === 'today' ? <Today /> : <All />}</div>
      {adding ? <MedForm onClose={() => setAdding(false)} onDone={() => setN(n + 1)} /> : null}
    </>
  );
}
