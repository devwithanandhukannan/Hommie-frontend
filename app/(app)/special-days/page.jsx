'use client';
import { useState } from 'react';
import { del, patch, post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Badge, Btn, Empty, ErrorNote, Field, Input, MemberSelect, PageHeader, Select, Sheet, Spinner, Tabs, useAction, useConfirm } from '@/components/ui';
import { daysLabel, longDate, shortDate, todayStr } from '@/lib/format';

function DateForm({ onClose, onDone }) {
  const { t } = useAuth();
  const KINDS = [
    ['birthday', t('days.type_bday')],
    ['anniversary', t('days.type_anniversary')],
    ['shraddham', t('days.type_shraddham')],
    ['festival', t('days.type_festival')],
    ['other', t('days.type_other')],
  ];
  const [f, setF] = useState({ title: '', kind: 'birthday', date: todayStr(), repeatYearly: true, remindDaysBefore: 7, checklist: '' });
  const [run, busy] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const checklist = f.checklist.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 40).map((text) => ({ text: text.slice(0, 120) }));
    if (await run(() => post('/special-dates', { title: f.title.trim(), kind: f.kind, date: f.date, repeatYearly: f.repeatYearly, remindDaysBefore: Number(f.remindDaysBefore) || 0, checklist }), 'Saved')) { onDone(); onClose(); }
  };
  return (
    <Sheet title={t('days.add_title')} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <Field label={t('days.field_title')}>{(id) => <Input id={id} required maxLength={100} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Onam" />}</Field>
        <div className="row wrap">
          <Field label={t('days.field_type')}>{(id) => <Select id={id} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
          <Field label={t('days.field_date')}>{(id) => <Input id={id} type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
          <Field label={t('days.field_remind')}>{(id) => <Input id={id} type="number" min={0} max={60} style={{ width: 90 }} value={f.remindDaysBefore} onChange={(e) => setF({ ...f, remindDaysBefore: e.target.value })} />}</Field>
        </div>
        <label className="check"><input type="checkbox" checked={f.repeatYearly} onChange={(e) => setF({ ...f, repeatYearly: e.target.checked })} /> {t('days.repeats_yearly')}</label>
        <Field label={t('days.field_checklist')} hint={t('days.checklist_hint')}>{(id) => <textarea id={id} className="textarea" rows={4} value={f.checklist} onChange={(e) => setF({ ...f, checklist: e.target.value })} />}</Field>
        <Btn type="submit" disabled={busy}>{t('btn.save')}</Btn>
      </form>
    </Sheet>
  );
}

function Dates() {
  const { family, t, lang } = useAuth();
  const KINDS = [
    ['birthday', t('days.type_bday')],
    ['anniversary', t('days.type_anniversary')],
    ['shraddham', t('days.type_shraddham')],
    ['festival', t('days.type_festival')],
    ['other', t('days.type_other')],
  ];
  const { data, error, loading, reload } = useData('/special-dates');
  const [adding, setAdding] = useState(false);
  const [run] = useAction();
  const confirm = useConfirm();
  const [item, setItem] = useState({});
  const act = (fn, msg) => run(async () => { await fn(); reload(); }, msg);
  const sorted = [...(data || [])].sort((a, b) => (a.nextDate || '9999').localeCompare(b.nextDate || '9999'));
  return (
    <>
      <div style={{ marginBottom: 12 }}><Btn onClick={() => setAdding(true)}>{t('days.add_btn')}</Btn></div>
      {loading && !data ? <Spinner /> : error ? <ErrorNote error={error} /> : !sorted.length ? <Empty>{t('days.empty')}</Empty> : (
        <div className="col">{sorted.map((d) => (
          <section key={d.id} className="card">
            <div className="row between"><h2>{d.title}</h2><Badge tone="info">{KINDS.find(([k]) => k === d.kind)?.[1] || d.kind}</Badge></div>
            <div className="small muted">{d.nextDate ? `${longDate(d.nextDate, lang)} (${daysLabel(d.daysAway)})` : `Past: ${shortDate(d.date, lang)}`}{d.repeatYearly ? ' · yearly' : ''}</div>
            {d.checklist.length ? <div className="list" style={{ marginTop: 8 }}>{d.checklist.map((c) => (
              <div key={c.id} className="item">
                <label className="check grow"><input type="checkbox" checked={c.done} onChange={(e) => act(() => patch(`/special-dates/${d.id}/checklist/${c.id}`, { done: e.target.checked }))} /><span style={c.done ? { textDecoration: 'line-through' } : undefined}>{c.text}</span></label>
                <div style={{ minWidth: 120 }}><MemberSelect aria-label={`Assign ${c.text}`} members={family.members} value={c.assignee?.membershipId} allowNone noneLabel="Unassigned" onChange={(v) => act(() => patch(`/special-dates/${d.id}/checklist/${c.id}`, { assigneeId: v }))} /></div>
                <Btn size="sm" tone="ghost" aria-label={`Remove ${c.text}`} onClick={() => act(() => del(`/special-dates/${d.id}/checklist/${c.id}`))}>×</Btn>
              </div>))}</div> : null}
            <form className="row" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); const txt = (item[d.id] || '').trim(); if (txt) act(() => post(`/special-dates/${d.id}/checklist`, { text: txt })).then(() => setItem({ ...item, [d.id]: '' })); }}>
              <Input aria-label={`Add checklist item to ${d.title}`} className="grow" maxLength={120} placeholder={t('days.add_checklist')} value={item[d.id] || ''} onChange={(e) => setItem({ ...item, [d.id]: e.target.value })} /><Btn type="submit" size="sm">{t('btn.add')}</Btn>
            </form>
            <div style={{ marginTop: 8 }}><Btn size="sm" tone="ghost" onClick={async () => { const msg = 'Delete ' + d.title + '?'; if (await confirm(msg)) act(() => del(`/special-dates/${d.id}`), 'Deleted'); }}>{t('btn.delete')}</Btn></div>
          </section>))}</div>
      )}
      {adding ? <DateForm onClose={() => setAdding(false)} onDone={reload} /> : null}
    </>
  );
}

function Guests() {
  const { t, lang } = useAuth();
  const { data, error, loading, reload } = useData('/guests');
  const [f, setF] = useState({ name: '', from: todayStr(), to: todayStr(), notes: '' });
  const [run, busy] = useAction();
  const add = async (e) => {
    e.preventDefault();
    const body = { name: f.name.trim(), from: f.from, to: f.to }; if (f.notes.trim()) body.notes = f.notes.trim();
    if (await run(() => post('/guests', body), 'Guest added')) { setF({ ...f, name: '', notes: '' }); reload(); }
  };
  return (
    <>
      <form className="card col" onSubmit={add} aria-label="Add guest">
        <div className="row wrap">
          <Field label="Guest">{(id) => <Input id={id} required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
          <Field label="Arrives">{(id) => <Input id={id} type="date" required value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} />}</Field>
          <Field label="Leaves">{(id) => <Input id={id} type="date" required min={f.from} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />}</Field>
        </div>
        <Field label="Notes (optional)">{(id) => <Input id={id} maxLength={300} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Vegetarian, needs the guest room" />}</Field>
        <div><Btn type="submit" disabled={busy}>{t('btn.add')} Guest</Btn></div>
      </form>
      {loading && !data ? <Spinner /> : error ? <ErrorNote error={error} /> : !data.length ? <Empty>No guests expected.</Empty> : (
        <div className="card list" style={{ marginTop: 12 }}>{data.map((g) => (
          <div key={g.id} className="item"><div className="grow"><div className="bold">{g.name}</div><div className="small muted">{shortDate(g.from, lang)} – {shortDate(g.to, lang)} · host {g.host?.displayName}{g.notes ? ` · ${g.notes}` : ''}</div></div><Btn size="sm" tone="ghost" onClick={() => run(async () => { await del(`/guests/${g.id}`); reload(); }, 'Removed')}>{t('btn.remove')}</Btn></div>))}</div>
      )}
    </>
  );
}

function Contacts() {
  const { t } = useAuth();
  const { data, error, loading, reload } = useData('/contacts');
  const [f, setF] = useState({ name: '', role: 'doctor', phone: '', notes: '' });
  const [run, busy] = useAction();
  const add = async (e) => {
    e.preventDefault();
    const body = { name: f.name.trim(), role: f.role, phone: f.phone.trim() }; if (f.notes.trim()) body.notes = f.notes.trim();
    if (await run(() => post('/contacts', body), 'Contact saved')) { setF({ ...f, name: '', phone: '', notes: '' }); reload(); }
  };
  return (
    <>
      <form className="card col" onSubmit={add} aria-label="Add contact">
        <div className="row wrap">
          <Field label={t('family.field_name')}>{(id) => <Input id={id} required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
          <Field label="Role">{(id) => <Select id={id} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{['doctor', 'plumber', 'electrician', 'neighbour', 'relative', 'other'].map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}</Select>}</Field>
          <Field label="Phone">{(id) => <Input id={id} type="tel" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+91 98765 43210" />}</Field>
        </div>
        <div><Btn type="submit" disabled={busy}>{t('btn.save')}</Btn></div>
      </form>
      {loading && !data ? <Spinner /> : error ? <ErrorNote error={error} /> : !data.length ? <Empty>Save the doctor, plumber, electrician and neighbours here.</Empty> : (
        <div className="card list" style={{ marginTop: 12 }}>{data.map((c) => (
          <div key={c.id} className="item"><div className="grow"><div className="bold">{c.name}</div><div className="small muted">{c.role}{c.notes ? ` · ${c.notes}` : ''}</div></div><a className="btn sm" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>Call {c.phone}</a><Btn size="sm" tone="ghost" onClick={() => run(async () => { await del(`/contacts/${c.id}`); reload(); }, 'Removed')}>{t('btn.remove')}</Btn></div>))}</div>
      )}
    </>
  );
}

export default function SpecialDaysPage() {
  const { t } = useAuth();
  const [tab, setTab] = useState('dates');
  return (
    <>
      <PageHeader title={t('days.title')} sub={t('days.sub')} />
      <Tabs value={tab} onChange={setTab} items={[['dates', t('days.title')], ['guests', 'Guests'], ['contacts', 'Contacts']]} />
      <div style={{ marginTop: 12 }}>{tab === 'dates' ? <Dates /> : tab === 'guests' ? <Guests /> : <Contacts />}</div>
    </>
  );
}
