'use client';
import Link from 'next/link';
import { post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Badge, Btn, Empty, ErrorNote, PageHeader, Spinner, useAction } from '@/components/ui';
import { timeAgo } from '@/lib/format';

export default function NotificationsPage() {
  const { families, t, tn } = useAuth();
  const { data, error, loading, reload } = useData('/me/notifications', { interval: 60000 });
  const [run] = useAction();
  const name = (id) => families.find((f) => f.id === id)?.name;
  if (loading && !data) return <Spinner />;
  return (
    <>
      <PageHeader title={t('notif.title')} sub={data?.unread ? `${data.unread} ${t('notif.unread')}` : t('notif.caught_up')}>
        {data?.unread ? <Btn size="sm" tone="ghost" onClick={() => run(async () => { await post('/me/notifications/read-all', {}); reload(); })}>{t('notif.mark_all')}</Btn> : null}
      </PageHeader>
      {error ? <ErrorNote error={error} /> : !data.items.length ? <Empty>{t('notif.empty')}</Empty> : (
        <div className="card list">
          {data.items.map((n) => (
            <Link key={n.id} href={n.familyId ? `/open?family=${n.familyId}&to=${encodeURIComponent(n.url)}` : n.url} className="item" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => { if (!n.read) post(`/me/notifications/${n.id}/read`, {}).catch(() => {}); }}>
              <div className="grow">
                <div className={n.read ? '' : 'bold'}>{tn(n.title)}</div>
                {n.body ? <div className="small muted">{tn(n.body)}</div> : null}
                <div className="tiny muted">{timeAgo(n.createdAt)}{name(n.familyId) && families.length > 1 ? ` · ${name(n.familyId)}` : ''}</div>
              </div>
              {!n.read ? <Badge tone="info">{t('notif.new')}</Badge> : null}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
