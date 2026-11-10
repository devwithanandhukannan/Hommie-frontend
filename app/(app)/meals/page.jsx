'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { put, post, del } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Btn, ErrorNote, Field, Input, MemberSelect, PageHeader, Select, Sheet, Spinner, useAction } from '@/components/ui';
import { addDaysStr, todayStr, longDate, shortDate } from '@/lib/format';

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

  const today = todayStr();
  const tomorrow = addDaysStr(today, 1);
  const yesterday = addDaysStr(today, -1);
  const dayLabel = (d) => {
    if (d === today) return { primary: 'Today', sub: shortDate(d, lang), isToday: true };
    if (d === tomorrow) return { primary: 'Tomorrow', sub: shortDate(d, lang), isToday: false };
    if (d === yesterday) return { primary: 'Yesterday', sub: shortDate(d, lang), isToday: false };
    return { primary: longDate(d, lang), sub: '', isToday: false };
  };

  return (
    <>
      <PageHeader title={t('meals.title')} sub={family.name}>
        <Btn tone="ghost" size="sm" onClick={() => setStart(addDaysStr(start, -7))}>{t('meals.prev_week')}</Btn>
        <Btn tone="ghost" size="sm" onClick={() => setStart(today)}>{t('meals.this_week')}</Btn>
        <Btn tone="ghost" size="sm" onClick={() => setStart(addDaysStr(start, 7))}>{t('meals.next_week')}</Btn>
        <Link href="/recipes" className="btn ghost sm">{t('nav.recipes')}</Link>
      </PageHeader>
      {loading && !data ? <Spinner /> : error ? <ErrorNote error={error} /> : (
        <div className="meal-tl">
          {days.map((d, di) => {
            const head = dayLabel(d);
            const isLastDay = di === days.length - 1;
            return (
              <section key={d} className={`meal-tl-day ${head.isToday ? 'is-today' : ''} ${isLastDay ? 'is-last-day' : ''}`} aria-label={longDate(d, lang)}>
                <h2 className="meal-tl-day-head">
                  <span className="meal-tl-day-dot" aria-hidden="true" />
                  <span>{head.primary}</span>
                  {head.sub ? <span className="meal-tl-day-sub">{head.sub}</span> : null}
                </h2>
                <div className="meal-tl-children">
                  <svg className="meal-tl-curve" width="44" height="39" viewBox="0 0 44 39" aria-hidden="true">
                    <path d="M 10 0 C 10 18, 33 15, 33 39" />
                  </svg>
                  {SLOTS.map(([slot, key], si) => {
                    const m = find(d, slot);
                    const hasMeal = Boolean(m?.items?.length);
                    const mine = m?.attendance.find((a) => a.member?.membershipId === me)?.status;
                    const outCount = m?.attendance.filter((a) => a.status === 'out').length || 0;
                    const slotLabel = t(key);
                    const meta = [
                      m?.recipe ? m.recipe.title : null,
                      m?.cook ? `Cook: ${m.cook.displayName}` : null,
                      m?.guests ? `${m.guests} guest${m.guests > 1 ? 's' : ''}` : null,
                      outCount ? `${outCount} skipping` : null,
                    ].filter(Boolean).join(' · ');
                    return (
                      <div
                        key={slot}
                        className={`meal-tl-item ${si === 0 ? 'is-first' : ''} ${si === SLOTS.length - 1 ? 'is-last' : ''} ${hasMeal ? 'is-planned' : ''}`}
                      >
                        <span className="meal-tl-dot" aria-hidden="true" />
                        <div className="meal-tl-pill">
                          <button type="button" className="meal-tl-main" onClick={() => setEdit({ d, slot, m })}>
                            <div className="meal-tl-line">
                              <span className="meal-tl-slot">{slotLabel}</span>
                              <span className={`meal-tl-dish ${hasMeal ? '' : 'is-empty'}`}>
                                {hasMeal ? m.items.join(', ') : t('meals.not_planned')}
                              </span>
                            </div>
                            {meta ? <div className="meal-tl-meta">{meta}</div> : null}
                          </button>
                          <div className="meal-tl-actions">
                            <button
                              type="button"
                              className={`meal-tl-rsvp ${mine === 'out' ? 'is-out' : ''}`}
                              aria-pressed={mine === 'out'}
                              onClick={() => rsvp(d, slot, mine === 'out' ? 'in' : 'out')}
                            >
                              {mine === 'out' ? t('meals.not_eating') : t('meals.im_eating')}
                            </button>
                            <button type="button" className="meal-tl-edit" onClick={() => setEdit({ d, slot, m })}>
                              {m ? t('btn.edit') : t('meals.plan')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {edit ? <EditSlot date={edit.d} slot={edit.slot} meal={edit.m} onClose={() => setEdit(null)} onDone={reload} /> : null}
    </>
  );
}
