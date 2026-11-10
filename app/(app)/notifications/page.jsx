'use client';
import Link from 'next/link';
import { useState } from 'react';
import { del, get, post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Badge, Btn, Empty, ErrorNote, PageHeader, Spinner, useAction } from '@/components/ui';
import { timeAgo } from '@/lib/format';

export default function NotificationsPage() {
  const { families, t, tn } = useAuth();
  const { data, error, loading, reload, setData } = useData('/me/notifications', { interval: 180000 });
  const [extra, setExtra] = useState({ items: [], hasMore: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [run] = useAction();
  const name = (id) => families.find((f) => f.id === id)?.name;
  if (loading && !data) return <Spinner />;

  const items = [...(data?.items || []), ...extra.items];
  const hasMore = extra.hasMore !== null ? extra.hasMore : Boolean(data?.hasMore);
  const hasRead = items.some((n) => n.read);

  const loadOlder = async () => {
    const last = items[items.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await get(`/me/notifications?before=${last.id}`);
      const seen = new Set(items.map((x) => x.id));
      setExtra((prev) => ({
        items: [...prev.items, ...(next.items || []).filter((x) => !seen.has(x.id))],
        hasMore: Boolean(next.hasMore),
      }));
    } catch {} finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      <PageHeader title={t('notif.title')} sub={data?.unread ? `${data.unread} ${t('notif.unread')}` : t('notif.caught_up')}>
        <div className="row" style={{ gap: 8 }}>
          {data?.unread ? (
            <Btn size="sm" tone="ghost" onClick={() => run(async () => { await post('/me/notifications/read-all', {}); reload(); })}>{t('notif.mark_all')}</Btn>
          ) : null}
          {hasRead ? (
            <Btn size="sm" tone="ghost" onClick={() => run(async () => {
              await del('/me/notifications');
              setExtra({ items: [], hasMore: null });
              setData((cur) => cur ? { ...cur, items: cur.items.filter((x) => !x.read) } : cur);
              reload();
            })}>{t('notif.clear_read')}</Btn>
          ) : null}
        </div>
      </PageHeader>
      {error ? <ErrorNote error={error} /> : !items.length ? <Empty>{t('notif.empty')}</Empty> : (
        <>
          <div className="card list">
            {items.map((n) => (
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
          {hasMore ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <Btn tone="ghost" size="sm" disabled={loadingMore} onClick={loadOlder}>{t('notif.load_more')}</Btn>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
