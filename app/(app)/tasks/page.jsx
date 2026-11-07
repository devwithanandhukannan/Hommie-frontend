'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { del, patch, post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Badge, Btn, Empty, ErrorNote, Field, Input, MemberSelect, PageHeader, Select, Sheet, Spinner, Tabs, useAction, useConfirm } from '@/components/ui';
import { shortDate, timeAgo, todayStr } from '@/lib/format';

function EditTaskSheet({ task, onClose, onDone }) {
  const { family, t } = useAuth();
  const [f, setF] = useState({
    title: task.title || '',
    description: task.description || '',
    dueDate: task.dueDate || '',
    assigneeId: task.assignee?.membershipId || null,
    kind: task.kind === 'chore' ? 'chore' : 'custom',
    repeat: task.repeat?.unit || 'none',
    status: task.status || 'open',
  });
  const [run, busy] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const body = {
      title: f.title.trim(),
      kind: f.kind,
      assigneeId: f.assigneeId || null,
      description: f.description.trim(),
      dueDate: f.dueDate || null,
      repeat: f.repeat !== 'none' ? { unit: f.repeat, everyN: 1 } : null,
      status: f.status,
    };
    if (await run(() => patch(`/tasks/${task.id}`, body), 'Task updated')) {
      onDone();
      onClose();
    }
  };
  return (
    <Sheet title={`${t('btn.edit')} · ${task.title}`} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <Field label={t('tasks.field_what')}>{(id) => <Input id={id} required maxLength={140} value={f.title} onChange={set('title')} />}</Field>
        <Field label={t('tasks.field_details')}>{(id) => <textarea id={id} className="textarea" maxLength={1000} value={f.description} onChange={set('description')} />}</Field>
        <div className="row wrap">
          <Field label={t('tasks.field_due')}>{(id) => <Input id={id} type="date" value={f.dueDate} onChange={set('dueDate')} />}</Field>
          <Field label={t('tasks.field_assign')}>{(id) => <MemberSelect id={id} members={family.members} value={f.assigneeId} onChange={(v) => setF({ ...f, assigneeId: v })} allowNone noneLabel={t('tasks.unassigned')} />}</Field>
        </div>
        <div className="row wrap">
          <Field label={t('tasks.field_type')}>{(id) => <Select id={id} value={f.kind} onChange={set('kind')}><option value="custom">{t('tasks.type_task')}</option><option value="chore">{t('tasks.type_chore')}</option></Select>}</Field>
          <Field label={t('tasks.field_repeat')}>{(id) => <Select id={id} value={f.repeat} onChange={set('repeat')}><option value="none">{t('tasks.repeat_none')}</option><option value="day">{t('tasks.repeat_day')}</option><option value="week">{t('tasks.repeat_week')}</option><option value="month">{t('tasks.repeat_month')}</option></Select>}</Field>
          <Field label={t('tasks.field_status')}>{(id) => <Select id={id} value={f.status} onChange={set('status')}><option value="open">{t('tasks.status_open')}</option><option value="done">{t('tasks.status_done')}</option></Select>}</Field>
        </div>
        <Btn type="submit" disabled={busy}>{t('tasks.save_btn')}</Btn>
      </form>
    </Sheet>
  );
}

function NewTask({ onClose, onDone }) {
  const { family, t } = useAuth();
  const [f, setF] = useState({ title: '', description: '', dueDate: '', assigneeId: null, kind: 'custom', repeat: 'none' });
  const [run, busy] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const body = { title: f.title, kind: f.kind, assigneeId: f.assigneeId };
    if (f.description) body.description = f.description;
    if (f.dueDate) body.dueDate = f.dueDate;
    if (f.repeat !== 'none') body.repeat = { unit: f.repeat, everyN: 1 };
    if (await run(() => post('/tasks', body), 'Task added')) { onDone(); onClose(); }
  };
  return (
    <Sheet title={t('tasks.new')} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <Field label={t('tasks.field_what')}>{(id) => <Input id={id} required maxLength={140} value={f.title} onChange={set('title')} placeholder={t('tasks.placeholder_what')} />}</Field>
        <Field label={t('tasks.field_details')}>{(id) => <textarea id={id} className="textarea" maxLength={1000} value={f.description} onChange={set('description')} />}</Field>
        <div className="row wrap">
          <Field label={t('tasks.field_due')}>{(id) => <Input id={id} type="date" min={todayStr()} value={f.dueDate} onChange={set('dueDate')} />}</Field>
          <Field label={t('tasks.field_assign')}>{(id) => <MemberSelect id={id} members={family.members} value={f.assigneeId} onChange={(v) => setF({ ...f, assigneeId: v })} allowNone noneLabel={t('tasks.unassigned')} />}</Field>
        </div>
        <div className="row wrap">
          <Field label={t('tasks.field_type')}>{(id) => <Select id={id} value={f.kind} onChange={set('kind')}><option value="custom">{t('tasks.type_task')}</option><option value="chore">{t('tasks.type_chore')}</option></Select>}</Field>
          <Field label={t('tasks.field_repeat')}>{(id) => <Select id={id} value={f.repeat} onChange={set('repeat')}><option value="none">{t('tasks.repeat_none')}</option><option value="day">{t('tasks.repeat_day')}</option><option value="week">{t('tasks.repeat_week')}</option><option value="month">{t('tasks.repeat_month')}</option></Select>}</Field>
        </div>
        <Btn type="submit" disabled={busy}>{t('tasks.add_btn')}</Btn>
      </form>
    </Sheet>
  );
}

export default function TasksPage() {
  const { family, me, t } = useAuth();
  const searchParams = useSearchParams();
  const urlScope = searchParams?.get('scope') || searchParams?.get('tab');
  const [scope, setScope] = useState(urlScope === 'done' || urlScope === 'mine' ? urlScope : 'open');
  const { data, error, loading, reload } = useData(`/tasks?scope=${scope}`, { interval: 30000 });
  const [run] = useAction();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const act = (fn, msg) => run(async () => { await fn(); reload(); }, msg);

  return (
    <>
      <PageHeader title={t('tasks.title')} sub={family.name}>
        <Btn onClick={() => setAdding(true)}>{t('tasks.new')}</Btn>
      </PageHeader>
      <Tabs value={scope} onChange={setScope} items={[['mine', t('tasks.mine')], ['open', t('tasks.everyone')], ['done', t('tasks.done')]]} />
      {loading && !data ? <Spinner /> : error ? <ErrorNote error={error} /> : data.length === 0 ? <Empty>{scope === 'done' ? t('tasks.no_done') : t('tasks.empty')}</Empty> : (
        <div className="card list" style={{ marginTop: 12 }}>
          {data.map((taskItem) => {
            const canEdit = taskItem.kind !== 'bill' && (taskItem.createdBy?.membershipId === me || family.myRole !== 'member');
            return (
              <div key={taskItem.id} className="item" style={{ alignItems: 'flex-start' }}>
                {taskItem.status === 'open' ? (
                  <button type="button" className="circle" aria-label={`Mark "${taskItem.title}" done`} onClick={() => act(() => post(`/tasks/${taskItem.id}/complete`, {}), 'Done')}>
                    <span />
                  </button>
                ) : (
                  <span className="circle" aria-hidden="true"><span style={{ background: 'var(--brand)' }} /></span>
                )}
                <div className="grow">
                  <div className="bold" style={taskItem.status === 'done' ? { textDecoration: 'line-through' } : undefined}>{taskItem.title}</div>
                  {taskItem.description ? <div className="small muted">{taskItem.description}</div> : null}
                  <div className="small muted">
                    {taskItem.status === 'done'
                      ? `${t('tasks.done_by')} ${taskItem.completedBy?.displayName || '—'} ${taskItem.completedAt ? timeAgo(taskItem.completedAt) : ''}`
                      : [
                          taskItem.assignee ? `${t('tasks.for')} ${taskItem.assignee.displayName}` : t('tasks.unassigned'),
                          taskItem.dueDate ? `${t('tasks.due')} ${shortDate(taskItem.dueDate)}` : null,
                          taskItem.repeat ? `${t('tasks.repeats')} ${taskItem.repeat.unit}` : null,
                        ].filter(Boolean).join(' · ')}
                  </div>
                  {taskItem.status === 'open' ? (
                    <div className="row wrap" style={{ marginTop: 6 }}>
                      {!taskItem.assignee ? <Btn size="sm" onClick={() => act(() => post(`/tasks/${taskItem.id}/claim`, {}), 'It is yours')}>{t('tasks.ill_do_it')}</Btn> : null}
                      <div style={{ minWidth: 150 }}>
                        <MemberSelect
                          aria-label={`Assign ${taskItem.title}`}
                          members={family.members}
                          value={taskItem.assignee?.membershipId}
                          allowNone
                          noneLabel={t('tasks.assign_dots')}
                          onChange={(v) => act(() => post(`/tasks/${taskItem.id}/assign`, { membershipId: v }))}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
                {taskItem.kind === 'chore' ? <Badge tone="info">{t('tasks.chore')}</Badge> : taskItem.kind === 'bill' ? <Badge tone="warn">{t('tasks.bill')}</Badge> : null}
                <div className="row" style={{ gap: 6 }}>
                  {canEdit ? <Btn tone="ghost" size="sm" aria-label={`Edit ${taskItem.title}`} onClick={() => setEditing(taskItem)}>{t('btn.edit')}</Btn> : null}
                  {taskItem.status === 'open' && canEdit ? (
                    <Btn tone="ghost" size="sm" aria-label={`Delete ${taskItem.title}`} onClick={async () => { if (await confirm('Delete this task?')) act(() => del(`/tasks/${taskItem.id}`), 'Deleted'); }}>
                      {t('btn.delete')}
                    </Btn>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {adding ? <NewTask onClose={() => setAdding(false)} onDone={reload} /> : null}
      {editing ? <EditTaskSheet task={editing} onClose={() => setEditing(null)} onDone={reload} /> : null}
    </>
  );
}
