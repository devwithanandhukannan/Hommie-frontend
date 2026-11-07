'use client';
import { useState } from 'react';
import { api, del, get, getBlob, patch, upload } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Badge, Btn, Empty, ErrorNote, Field, Input, MemberChecks, PageHeader, Select, Sheet, Spinner, useAction, useConfirm, useAlert } from '@/components/ui';
import { timeAgo } from '@/lib/format';

const CATS = ['identity', 'insurance', 'vehicle', 'property', 'medical', 'bank', 'tax', 'education', 'other'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const VIS = { private: 'Only me', family: 'Whole family', custom: 'Selected people' };

function Visibility({ value, allowed, onChange, onAllowed }) {
  const { family } = useAuth();
  return (
    <>
      <Field label="Who can see it">{(id) => <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{Object.entries(VIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
      {value === 'custom' ? <Field label="Choose people">{() => <MemberChecks members={family.members.filter((m) => m.membershipId !== family.myMembershipId)} value={allowed} onChange={onAllowed} />}</Field> : null}
    </>
  );
}

function UploadForm({ onClose, onDone }) {
  const { t } = useAuth();
  const [f, setF] = useState({ title: '', category: 'identity', visibilityMode: 'private', allowed: [], expiryDate: '', maskedNumber: '' });
  const [file, setFile] = useState(null);
  const [run, busy] = useAction();
  const alert = useAlert();
  const save = async (e) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { await alert('File must be under 4 MB'); return; }
    const fd = new FormData();
    fd.append('title', f.title.trim()); fd.append('category', f.category); fd.append('visibilityMode', f.visibilityMode);
    if (f.visibilityMode === 'custom') fd.append('allowedIds', JSON.stringify(f.allowed));
    if (f.expiryDate) fd.append('expiryDate', f.expiryDate);
    if (f.maskedNumber.trim()) fd.append('maskedNumber', f.maskedNumber.trim());
    fd.append('file', file);
    if (await run(() => upload('/documents', fd), 'Document saved')) { onDone(); onClose(); }
  };
  return (
    <Sheet title={t('docs.upload_title')} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <Field label={t('days.field_title')}>{(id) => <Input id={id} required maxLength={100} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Aadhaar – Achan" />}</Field>
        <Field label={t('docs.field_file')}>{(id) => <input id={id} type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />}</Field>
        <Field label={t('money.field_category')}>{(id) => <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c} value={c}>{t('cat.' + c) || cap(c)}</option>)}</Select>}</Field>
        <Visibility value={f.visibilityMode} allowed={f.allowed} onChange={(v) => setF({ ...f, visibilityMode: v })} onAllowed={(a) => setF({ ...f, allowed: a })} />
        <Field label={t('docs.field_expiry')}>{(id) => <Input id={id} type="date" value={f.expiryDate} onChange={(e) => setF({ ...f, expiryDate: e.target.value })} />}</Field>
        <Field label={t('docs.field_last4')} hint={t('docs.last4_hint')}>{(id) => <Input id={id} maxLength={24} value={f.maskedNumber} onChange={(e) => setF({ ...f, maskedNumber: e.target.value })} />}</Field>
        <Btn type="submit" disabled={busy}>{t('docs.upload')}</Btn>
      </form>
    </Sheet>
  );
}

function Manage({ doc, onClose, onDone }) {
  const { t } = useAuth();
  const [mode, setMode] = useState(doc.visibilityMode);
  const [allowed, setAllowed] = useState((doc.allowed || []).map((m) => m.membershipId));
  const [log, setLog] = useState(null);
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const alert = useAlert();
  const save = async () => {
    if (mode === 'custom' && !allowed.length) { await alert('Choose at least one person'); return; }
    const body = { visibilityMode: mode }; if (mode === 'custom') body.allowedIds = allowed;
    if (await run(() => patch(`/documents/${doc.id}`, body), 'Access updated')) { onDone(); onClose(); }
  };
  const remove = async () => { const msg = 'Delete "' + doc.title + '" permanently?'; if (await confirm(msg) && await run(() => del(`/documents/${doc.id}`), 'Deleted')) { onDone(); onClose(); } };
  return (
    <Sheet title={doc.title} onClose={onClose}>
      <div className="col">
        <Visibility value={mode} allowed={allowed} onChange={setMode} onAllowed={setAllowed} />
        <div className="row"><Btn onClick={save} disabled={busy}>{t('docs.save_access')}</Btn><Btn tone="ghost" onClick={remove} disabled={busy}>{t('btn.delete')}</Btn></div>
        <Btn tone="ghost" onClick={() => get(`/documents/${doc.id}/access-log`).then(setLog).catch(() => setLog([]))}>{t('docs.access_log')}</Btn>
        {log ? (log.length ? <div className="list">{log.map((l, i) => <div key={i} className="item small">{l.by?.displayName} · {l.action} · {timeAgo(l.at)}</div>)}</div> : <Empty>No access recorded yet.</Empty>) : null}
      </div>
    </Sheet>
  );
}

export default function DocumentsPage() {
  const { t } = useAuth();
  const { data, error, loading, reload } = useData('/documents');
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(null);
  const [run] = useAction();
  const [cat, setCat] = useState('all');
  const open = (d) => run(async () => {
    const blob = await getBlob(`/documents/${d.id}/file`);
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener');
    if (!w) { const a = document.createElement('a'); a.href = url; a.download = d.title; a.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  const download = (d) => run(async () => {
    const blob = await getBlob(`/documents/${d.id}/file`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = d.title || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  const shown = (data || []).filter((d) => cat === 'all' || d.category === cat);
  return (
    <>
      <PageHeader title={t('docs.title')} sub={t('docs.sub')}><Btn onClick={() => setAdding(true)}>{t('docs.upload')}</Btn></PageHeader>
      <Select aria-label="Filter by category" value={cat} onChange={(e) => setCat(e.target.value)} style={{ maxWidth: 220 }}><option value="all">{t('docs.all_cats')}</option>{CATS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</Select>
      {loading && !data ? <Spinner /> : error ? <ErrorNote error={error} /> : !shown.length ? <Empty>{t('docs.empty')}</Empty> : (
        <div className="card list" style={{ marginTop: 12 }}>
          {shown.map((d) => (
            <div key={d.id} className="item">
              <div className="grow">
                <div className="bold">{d.title}</div>
                <div className="small muted">{cap(d.category)} · {d.isOwner ? VIS[d.visibilityMode] : `Shared by ${d.owner?.displayName}`}{d.maskedNumber ? ` · ${d.maskedNumber}` : ''}</div>
              </div>
              {d.expiresInDays != null && d.expiresInDays <= 30 ? <Badge tone={d.expiresInDays < 8 ? 'danger' : 'warn'}>{d.expiresInDays < 0 ? 'Expired' : `Expires in ${d.expiresInDays}d`}</Badge> : null}
              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => open(d)}
                  title={t('docs.view')}
                  aria-label={t('docs.view')}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--card-subtle, rgba(0,0,0,0.04))',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text)',
                    transition: 'background 0.15s ease, transform 0.1s ease',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => download(d)}
                  title={t('docs.download')}
                  aria-label={t('docs.download')}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--card-subtle, rgba(0,0,0,0.04))',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text)',
                    transition: 'background 0.15s ease, transform 0.1s ease',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
                {d.isOwner ? (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setManaging(d)}
                    title={t('docs.manage')}
                    aria-label={t('docs.manage')}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--card-subtle, rgba(0,0,0,0.04))',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text)',
                      transition: 'background 0.15s ease, transform 0.1s ease',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      {adding ? <UploadForm onClose={() => setAdding(false)} onDone={reload} /> : null}
      {managing ? <Manage doc={managing} onClose={() => setManaging(null)} onDone={reload} /> : null}
    </>
  );
}
