'use client';
import { useMemo, useState } from 'react';
import { put, post, del } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Badge, Btn, ErrorNote, Field, Input, MemberSelect, PageHeader, Select, Sheet, Spinner, useAction } from '@/components/ui';
import { addDaysStr, todayStr, longDate } from '@/lib/format';

const SLOTS = [['morning', 'meals.morning'], ['noon', 'meals.noon'], ['night', 'meals.night']];

function EditSlot({ date, slot, meal, onClose, onDone }) {
  const { family, t, lang } = useAuth();
  const { data: recipes } = useData('/recipes');
  const [items, setItems] = useState((meal?.items || []).join(', '));
  const [recipeId, setRecipeId] = useState(meal?.recipe?.id || '');
  const [cookId, setCookId] = useState(meal?.cook?.membershipId || null);
  const [run, busy] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const list = items.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12);
    if (await run(() => put(`/meals/${date}/${slot}`, { items: list, recipeId: recipeId || null, cookId }), 'Saved')) { onDone(); onClose(); }
  };
  const clear = async () => { if (await run(() => del(`/meals/${date}/${slot}`), 'Cleared')) { onDone(); onClose(); } };
  const slotLabel = t(`meals.${slot}`) || slot;
  return (
    <Sheet title={`${slotLabel} · ${longDate(date, lang)}`} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <Field label={t('meals.whats_cooking')} hint="Separate dishes with commas">{(id) => <Input id={id} value={items} onChange={(e) => setItems(e.target.value)} placeholder="Idli, sambar" />}</Field>
        <Field label={t('meals.recipe_optional')}>{(id) => <Select id={id} value={recipeId} onChange={(e) => setRecipeId(e.target.value)}><option value="">None</option>{(recipes || []).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</Select>}</Field>
        <Field label={t('meals.cook')}>{(id) => <MemberSelect id={id} members={family.members} value={cookId} onChange={setCookId} allowNone noneLabel="Anyone" />}</Field>
        <div className="row"><Btn type="submit" disabled={busy}>{t('btn.save')}</Btn>{meal ? <Btn tone="ghost" onClick={clear} disabled={busy}>{t('meals.clear')}</Btn> : null}</div>
      </form>
    </Sheet>
  );
}

export default function MealsPage() {
  const { family, me, t, lang } = useAuth();
  const [start, setStart] = useState(todayStr());
  const to = addDaysStr(start, 6);
  const { data, error, loading, reload } = useData(`/meals?from=${start}&to=${to}`);
  const [edit, setEdit] = useState(null);
  const [run] = useAction();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysStr(start, i)), [start]);
  const find = (d, s) => (data || []).find((m) => m.date === d && m.slot === s);
  const rsvp = (d, s, status) => run(async () => { await post(`/meals/${d}/${s}/attendance`, { status }); reload(); });

  return (
    <>
      <PageHeader title={t('meals.title')} sub={family.name}>
        <Btn tone="ghost" size="sm" onClick={() => setStart(addDaysStr(start, -7))}>{t('meals.prev_week')}</Btn>
        <Btn tone="ghost" size="sm" onClick={() => setStart(todayStr())}>{t('meals.this_week')}</Btn>
        <Btn tone="ghost" size="sm" onClick={() => setStart(addDaysStr(start, 7))}>{t('meals.next_week')}</Btn>
      </PageHeader>
      {loading && !data ? <Spinner /> : error ? <ErrorNote error={error} /> : (
        <div className="col">
          {days.map((d) => (
            <section key={d} className="card" aria-label={longDate(d, lang)}>
              <h2>{longDate(d, lang)}{d === todayStr() ? <> <Badge tone="info">{t('dash.coming') ? 'Today' : 'Today'}</Badge></> : null}</h2>
              <div className="list">
                {SLOTS.map(([slot, key]) => {
                  const m = find(d, slot);
                  const mine = m?.attendance.find((a) => a.member?.membershipId === me)?.status;
                  const outCount = m?.attendance.filter((a) => a.status === 'out').length || 0;
                  const slotLabel = t(key);
                  return (
                    <div key={slot} className="item" style={{ alignItems: 'flex-start' }}>
                      <div style={{ width: 85 }} className="bold small">{slotLabel}</div>
                      <div className="grow">
                        <div>{m?.items.length ? m.items.join(', ') : <span className="muted">{t('meals.not_planned')}</span>}</div>
                        <div className="small muted">{[m?.recipe ? `Recipe: ${m.recipe.title}` : null, m?.cook ? `Cook: ${m.cook.displayName}` : null, m?.guests ? `${m.guests} guest${m.guests > 1 ? 's' : ''}` : null, outCount ? `${outCount} skipping` : null].filter(Boolean).join(' · ')}</div>
                        <div className="row wrap" style={{ marginTop: 6 }}>
                          <Btn size="sm" tone={mine === 'out' ? '' : 'ghost'} aria-pressed={mine === 'out'} onClick={() => rsvp(d, slot, mine === 'out' ? 'in' : 'out')}>{mine === 'out' ? t('meals.not_eating') : t('meals.im_eating')}</Btn>
                        </div>
                      </div>
                      <Btn size="sm" tone="ghost" onClick={() => setEdit({ d, slot, m })}>{m ? t('btn.edit') : t('meals.plan')}</Btn>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {edit ? <EditSlot date={edit.d} slot={edit.slot} meal={edit.m} onClose={() => setEdit(null)} onDone={reload} /> : null}
    </>
  );
}
