'use client';
import { useRouter } from 'next/navigation';
import { useAuth, useData } from '@/lib/auth';
import { Badge, Btn, Empty, ErrorNote, PageHeader, Spinner } from '@/components/ui';
import { shortDate } from '@/lib/format';

export default function AllFamilies() {
  const { switchFamily } = useAuth();
  const router = useRouter();
  const { data, error, loading } = useData('/overview', { interval: 60000 });
  const go = async (id, to) => { await switchFamily(id); router.push(to); };
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  return (
    <>
      <PageHeader title="All families" sub="Your tasks from every family in one place" />
      {!data.length ? <Empty>You are not in any family yet.</Empty> : (
        <div className="col">{data.map((f) => (
          <section key={f.id} className="card">
            <div className="row between"><h2>{f.name}</h2><div className="row">{f.billsDue ? <Badge tone="danger">{f.billsDue} bill{f.billsDue > 1 ? 's' : ''} due</Badge> : null}{f.unreadChat ? <Badge tone="info">{f.unreadChat} new</Badge> : null}</div></div>
            <div className="small muted">{f.myRole} · {f.memberCount} member{f.memberCount === 1 ? '' : 's'} · {f.openTasksForMe} task{f.openTasksForMe === 1 ? '' : 's'} for you</div>
            {f.tasks.length ? <div className="list" style={{ marginTop: 8 }}>{f.tasks.map((t) => <div key={t.id} className="item"><div className="grow">{t.title}</div>{t.dueDate ? <span className="small muted">{shortDate(t.dueDate)}</span> : null}</div>)}</div> : null}
            <div className="row" style={{ marginTop: 8 }}><Btn size="sm" onClick={() => go(f.id, '/dashboard')}>Open dashboard</Btn><Btn size="sm" tone="ghost" onClick={() => go(f.id, '/tasks')}>Tasks</Btn></div>
          </section>))}</div>
      )}
    </>
  );
}
