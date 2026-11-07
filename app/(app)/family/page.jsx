'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { del, get, patch, post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Avatar, Badge, Btn, Empty, ErrorNote, Field, Input, PageHeader, Select, Sheet, Spinner, Tabs, useAction, useConfirm, useToast } from '@/components/ui';
import { timeAgo } from '@/lib/format';

const RELATIONS = ['self', 'father', 'mother', 'brother', 'sister', 'spouse', 'partner', 'child', 'grandparent', 'friend', 'other'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function CodeBox({ title, code, note, onClose }) {
  const { t } = useAuth();
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="col">
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, textAlign: 'center', padding: 12, background: 'var(--surface-2)', borderRadius: 12, userSelect: 'all' }}>{code}</div>
        <p className="small muted" style={{ margin: 0 }}>{note}</p>
        <Btn onClick={() => navigator.clipboard?.writeText(code)}>{t('family.copy_code')}</Btn>
      </div>
    </Sheet>
  );
}

function Members() {
  const { family, reloadFamily, me, t } = useAuth();
  const owner = family.myRole === 'owner'; const admin = family.myRole !== 'member';
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const [add, setAdd] = useState({ displayName: '', relation: 'other', role: 'member' });
  const [code, setCode] = useState(null);
  const invite = async (linkTo) => {
    const body = linkTo ? { linkToMembershipId: linkTo, expiresInHours: 48, maxUses: 1 } : { expiresInHours: 48, maxUses: 1 };
    const r = await run(() => post('/families/current/invites', body));
    if (r && r !== true) setCode({ title: t('family.invite'), code: r.code, note: t('family.invite_account_sub') });
  };
  const reset = async (m) => { const r = await run(() => post(`/families/current/members/${m.membershipId}/reset-code`, {})); if (r && r !== true) setCode({ title: `${t('family.reset_code')} · ${m.displayName}`, code: r.code, note: `Give this to ${m.displayName}. It expires in ${r.expiresInMinutes} minutes.` }); };
  const addMember = async (e) => { e.preventDefault(); if (await run(() => post('/families/current/members', add), 'Member added')) { setAdd({ displayName: '', relation: 'other', role: 'member' }); reloadFamily(); } };
  const remove = async (m) => { const msg = m.membershipId === me ? 'Leave this family?' : 'Remove ' + m.displayName + '?'; if (await confirm(msg) && await run(() => del(`/families/current/members/${m.membershipId}`), 'Done')) reloadFamily(); };
  const setRole = (m, role) => run(async () => { await patch(`/families/current/members/${m.membershipId}`, { role }); await reloadFamily(); }, 'Role updated');
  return (
    <>
      <div className="card list">
        {family.members.map((m) => (
          <div key={m.membershipId} className="item" style={{ flexWrap: 'wrap' }}>
            <Avatar member={m} /><div className="grow"><div className="bold">{m.displayName}{m.membershipId === me ? ' (you)' : ''}</div><div className="small muted">{cap(m.relation || 'other')} · {m.role === 'owner' ? t('family.role_owner') : m.role === 'admin' ? t('family.role_admin') : t('family.role_member')}{m.hasAccount === false ? ' · no account yet' : ''}</div></div>
            {owner && m.role !== 'owner' ? <Select aria-label={`Role for ${m.displayName}`} style={{ width: 110 }} value={m.role} onChange={(e) => setRole(m, e.target.value)}><option value="member">{t('family.role_member')}</option><option value="admin">{t('family.role_admin')}</option></Select> : <Badge>{m.role === 'owner' ? t('family.role_owner') : m.role === 'admin' ? t('family.role_admin') : t('family.role_member')}</Badge>}
            {admin && m.hasAccount === false ? <Btn size="sm" onClick={() => invite(m.membershipId)}>{t('family.invite')}</Btn> : null}
            {admin && m.hasAccount && m.membershipId !== me ? <Btn size="sm" tone="ghost" onClick={() => reset(m)}>{t('family.reset_code')}</Btn> : null}
            {(admin && m.role !== 'owner' && m.membershipId !== me) || (m.membershipId === me && m.role !== 'owner') ? <Btn size="sm" tone="ghost" onClick={() => remove(m)}>{m.membershipId === me ? t('family.leave') : t('family.remove')}</Btn> : null}
          </div>))}
      </div>
      {admin ? (
        <>
          <section className="card" style={{ marginTop: 12 }}><h2>{t('family.invite_account_title')}</h2><p className="small muted">{t('family.invite_account_sub')}</p><Btn onClick={() => invite()} disabled={busy}>{t('family.create_code_btn')}</Btn></section>
          <form className="card col" style={{ marginTop: 12 }} onSubmit={addMember}>
            <h2>{t('family.add_member_title')}</h2><p className="small muted" style={{ margin: 0 }}>{t('family.add_member_sub')}</p>
            <div className="row wrap">
              <Field label={t('family.field_name')}>{(id) => <Input id={id} required maxLength={60} value={add.displayName} onChange={(e) => setAdd({ ...add, displayName: e.target.value })} />}</Field>
              <Field label={t('family.field_relation')}>{(id) => <Select id={id} value={add.relation} onChange={(e) => setAdd({ ...add, relation: e.target.value })}>{RELATIONS.map((r) => <option key={r} value={r}>{cap(r)}</option>)}</Select>}</Field>
            </div>
            <div><Btn type="submit" disabled={busy}>{t('btn.add')}</Btn></div>
          </form>
        </>
      ) : null}
      {code ? <CodeBox {...code} onClose={() => setCode(null)} /> : null}
    </>
  );
}

function Settings() {
  const { family, reloadFamily, signOut, user, t } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(family.name);
  const [muted, setMuted] = useState(false);
  const [run, busy] = useAction();
  const admin = family.myRole !== 'member';
  useEffect(() => setName(family.name), [family.name]);
  return (
    <div className="col">
      {admin ? <form className="card row" onSubmit={async (e) => { e.preventDefault(); if (await run(() => patch('/families/current', { name: name.trim() }), 'Saved')) reloadFamily(); }}>
        <Field label={t('family.title')}>{(id) => <Input id={id} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />}</Field><Btn type="submit" disabled={busy}>{t('btn.save')}</Btn></form> : null}
      <section className="card"><h2>Chat notifications</h2><label className="check"><input type="checkbox" checked={muted} onChange={(e) => { setMuted(e.target.checked); run(() => post('/families/current/mute-chat', { muted: e.target.checked })); }} /> Mute chat push notifications for this family</label></section>
      {family.myRole === 'owner' ? <section className="card"><h2>Delete family</h2><p className="small muted">Deletes every bill, document and message in {family.name}. This cannot be undone.</p>
        <Btn tone="danger" onClick={async () => { const c = prompt(`Type "${family.name}" to confirm`); if (c && await run(() => del('/families/current', { confirmName: c }), 'Family deleted')) { await signOut(); router.replace('/login'); } }}>Delete this family</Btn></section> : null}
      <p className="small muted">Signed in as {user.email}</p>
    </div>
  );
}

function Audit() {
  const { data, error, loading } = useData('/families/current/audit');
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  if (!data.length) return <Empty>No activity yet.</Empty>;
  return <div className="card list">{data.map((a) => <div key={a.id} className="item small"><div className="grow"><b>{a.actor?.displayName || 'System'}</b> · {a.action}{a.entity ? ` (${a.entity})` : ''}</div><span className="muted">{timeAgo(a.at)}</span></div>)}</div>;
}

const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };

function Account() {
  const { user, setUser, signOut, t, setLang } = useAuth();
  const toast = useToast();
  const [run, busy] = useAction();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [push, setPush] = useState('unknown');
  const sessions = useData('/me/sessions');
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setPush('unsupported'); return; }
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setPush(s ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off')).catch(() => setPush('unsupported'));
  }, []);
  const enablePush = () => run(async () => {
    const h = await get('/health', { auth: false, family: false });
    if (!h.push || !h.vapidPublicKey) throw new Error('Push notifications are not set up on this server yet.');
    if ((await Notification.requestPermission()) !== 'granted') { setPush('denied'); throw new Error('Notifications are blocked in your browser settings.'); }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(h.vapidPublicKey) });
    const j = sub.toJSON();
    await post('/me/push-subscriptions', { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth }, deviceName: (navigator.userAgentData?.platform || navigator.platform || 'Browser').slice(0, 60) });
    setPush('on');
  }, 'Notifications on');
  return (
    <div className="col">
      <section className="card"><h2>Notifications on this device</h2>
        {push === 'unsupported' ? <p className="small muted">This browser does not support push. On iPhone, add the app to the Home Screen first.</p> : push === 'on' ? <Badge tone="ok">Enabled</Badge> : <Btn onClick={enablePush} disabled={busy || push === 'denied'}>{push === 'denied' ? 'Blocked in browser' : 'Turn on notifications'}</Btn>}</section>
      <form className="card col" onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const newLang = f.elements.language.value; const r = await run(() => patch('/me', { name: f.elements.name.value.trim(), language: newLang }), 'Saved'); if (r && r !== true) { setUser(r); if (newLang) setLang(newLang); } }}>
        <h2>{t('settings.account')}</h2>
        <Field label={t('settings.name')}>{(id) => <Input id={id} name="name" required maxLength={80} defaultValue={user.name} />}</Field>
        <Field label={t('settings.language')}>{(id) => (
          <Select id={id} name="language" defaultValue={user.language}>
            <option value="en">English</option>
            <option value="ml">മലയാളം</option>
            <option value="ta">தமிழ்</option>
            <option value="hi">हिन्दी</option>
          </Select>
        )}</Field>
        <div><Btn type="submit" disabled={busy}>{t('btn.save')}</Btn></div>
      </form>
      <form className="card col" onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const r = await run(() => post('/me/password', pw), 'Password changed. Other devices were signed out.'); if (r) setPw({ currentPassword: '', newPassword: '' }); }}>
        <h2>Change password</h2>
        <Field label="Current password">{(id) => <Input id={id} type="password" autoComplete="current-password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />}</Field>
        <Field label="New password" hint="At least 10 characters">{(id) => <Input id={id} type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />}</Field>
        <div><Btn type="submit" disabled={busy}>Change password</Btn></div>
      </form>
      <section className="card"><h2>Signed-in devices</h2>
        {sessions.data ? <div className="list">{sessions.data.map((s) => <div key={s.id} className="item"><div className="grow small">{s.device || 'Device'}{s.current ? ' (this one)' : ''}<div className="muted">{timeAgo(s.lastUsedAt)}</div></div>{!s.current ? <Btn size="sm" tone="ghost" onClick={() => run(async () => { await del(`/me/sessions/${s.id}`); sessions.reload(); }, 'Signed out')}>{t('btn.signout')}</Btn> : null}</div>)}</div> : <Spinner />}</section>
      <section className="card"><h2>Delete my account</h2><p className="small muted">Removes your login and leaves every family. Families you own must be transferred or deleted first.</p>
        <Btn tone="danger" onClick={async () => { const p = prompt('Enter your password to delete your account'); if (p && await run(() => del('/me', { password: p }), 'Account deleted')) await signOut(); }}>Delete account</Btn></section>
    </div>
  );
}

export default function FamilyPage() {
  const { family, myRole, t } = useAuth();
  const [tab, setTab] = useState('members');
  const tabs = [['members', t('family.tab_members')], ['settings', t('nav.family') || 'Family'], ['account', t('settings.account')]];
  if (myRole !== 'member') tabs.splice(2, 0, ['audit', 'Activity']);
  return (
    <>
      <PageHeader title={family.name} sub={myRole === 'owner' ? t('family.role_owner') : myRole === 'admin' ? t('family.role_admin') : t('family.role_member')} />
      <Tabs value={tab} onChange={setTab} items={tabs} />
      <div style={{ marginTop: 12 }}>{tab === 'members' ? <Members /> : tab === 'settings' ? <Settings /> : tab === 'audit' ? <Audit /> : <Account />}</div>
    </>
  );
}
