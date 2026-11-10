'use client';
import { useEffect, useRef, useState } from 'react';
import { post, patch, del } from '@/lib/api';
import { useAuth, useData, notifyChanged } from '@/lib/auth';
import { Btn, Empty, ErrorNote, Field, Icon, Input, Sheet, Spinner, useAction, useToast } from '@/components/ui';
import { toPaise, timeAgo } from '@/lib/format';
import Accordion from '@/components/Accordion';

const tileOf = (name) => { let h = 0; for (const c of name) h = (h * 31 + c.codePointAt(0)) % 5; return `t${h}`; };
const initial = (name) => Array.from(name.trim())[0]?.toUpperCase() || '·';
const lead = (q) => /^(\d+(?:\.\d+)?)\s*(.*)$/.exec(String(q || '').trim());


function ItemSheet({ item, onClose, onDone }) {
  const { t } = useAuth();
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.qty || '');
  const [price, setPrice] = useState(item.lastPrice ? String(item.lastPrice / 100) : '');
  const [run, busy] = useAction();

  const save = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    const ok = await run(async () => {
      if (cleanName !== item.name || qty.trim() !== (item.qty || '')) await patch(`/grocery/${item.id}`, { name: cleanName, qty: qty.trim() || undefined });
      const p = toPaise(price);
      // Recording the cost also adds it to the family expenses (split equally); repeating it only corrects that expense.
      if (p && p !== item.lastPrice) await post(`/grocery/${item.id}/price`, { price: p });
    });
    if (ok) { onDone(); onClose(); }
  };
  const remove = async () => { if (await run(() => del(`/grocery/${item.id}`))) { onDone(); onClose(); } };

  return (
    <Sheet title={item.name} onClose={onClose}>
      <form className="col" onSubmit={save}>
        <Field label={t('add.grocery')}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />}</Field>
        <Field label="Qty">{(id) => (
          <div className="row" style={{ gap: 10 }}>
            <Input id={id} value={qty} onChange={(e) => setQty(e.target.value)} maxLength={30} placeholder="1 L, 500 g…" />
            <div className="stepper" role="group" aria-label="Quantity">
              <button type="button" aria-label="−" onClick={() => { const m = lead(qty); if (m) setQty(Number(m[1]) <= 1 ? m[2] : `${Number(m[1]) - 1} ${m[2]}`.trim()); }}>−</button>
              <button type="button" aria-label="+" onClick={() => { const m = lead(qty); setQty(m ? `${Number(m[1]) + 1} ${m[2]}`.trim() : `1 ${qty}`.trim()); }}>+</button>
            </div>
          </div>
        )}</Field>
        <Field label={`₹ ${t('add.amount')}`} hint="Added to the family expenses, split equally">{(id) => <Input id={id} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />}</Field>
        <Btn type="submit" disabled={busy || !name.trim()}>{t('btn.save')}</Btn>
        <Btn type="button" tone="ghost" onClick={remove} disabled={busy}>{t('btn.delete')}</Btn>
      </form>
    </Sheet>
  );
}

export default function Grocery() {
  const { t } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useData('/grocery', { interval: 20000 });
  const [run] = useAction();
  const [text, setText] = useState('');
  const [edit, setEdit] = useState(null);
  const inputRef = useRef(null);
  useEffect(() => { if (new URLSearchParams(window.location.search).get('add') === '1') inputRef.current?.focus(); }, []);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorNote error={error} />;
  const items = data || [];
  const needed = items.filter((g) => g.status === 'needed');
  const stocked = items.filter((g) => g.status !== 'needed').sort((a, b) => String(b.lastBought?.at || '').localeCompare(String(a.lastBought?.at || '')));
  const changed = () => { notifyChanged(); reload(); };

  const add = async (e) => {
    e.preventDefault();
    const names = text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    setText('');
    if (!(await run(async () => { for (const name of names) await post('/grocery', { name }); }))) setText(names.join(', '));
    else changed();
  };

  // Tapping the circle is instant: the row moves right away and the server catches up.
  const flip = async (item, to) => {
    const prev = items;
    setData(items.map((g) => (g.id === item.id ? { ...g, status: to === 'bought' ? 'in_stock' : 'needed' } : g)));
    const ok = await run(() => post(`/grocery/${item.id}/${to === 'bought' ? 'bought' : 'need'}`, {}));
    if (!ok) setData(prev); else changed();
  };

  return (
    <div>
      <form className="shop-add" onSubmit={add}>
        <input ref={inputRef} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('add.grocery_ph')} aria-label={t('add.grocery')} maxLength={400} />
        <Btn type="submit" disabled={!text.trim()}>{t('btn.add')}</Btn>
      </form>

      {needed.length === 0 ? <Empty>{t('today.calm')}</Empty> : (
        <div className="pcards" role="list">
          {needed.map((g) => (
            <div className="pcard" role="listitem" key={g.id}>
              <span className={`ptile ${tileOf(g.name)}`} aria-hidden="true">{initial(g.name)}</span>
              <button type="button" className="pbody" onClick={() => setEdit(g)}>
                <div className="pname">{g.name}</div>
                {g.qty || g.lastPrice ? <div className="psub">{[g.qty, g.lastPrice ? `₹${Math.round(g.lastPrice / 100)}` : ''].filter(Boolean).join(' · ')}</div> : null}
              </button>
              <button type="button" className="round-act" aria-label={`${g.name} ✓`} onClick={() => flip(g, 'bought')}><Icon name="check" size={22} /></button>
            </div>
          ))}
        </div>
      )}

      {stocked.length ? (
        <div style={{ marginTop: 18 }}>
          <Accordion items={[{
            id: 'stock', title: t('grocery.in_stock') || 'In stock', badge: stocked.length,
            body: (
              <div className="pcards">
                {stocked.map((g) => (
                  <div className="pcard is-stock" key={g.id}>
                    <span className={`ptile ${tileOf(g.name)}`} aria-hidden="true">{initial(g.name)}</span>
                    <button type="button" className="pbody" onClick={() => setEdit(g)}>
                      <div className="pname">{g.name}</div>
                      <div className="psub">{[g.lastPrice ? `₹${Math.round(g.lastPrice / 100)}` : '', g.lastBought?.at ? timeAgo(g.lastBought.at) : ''].filter(Boolean).join(' · ')}</div>
                    </button>
                    <button type="button" className="round-act quiet" style={{ width: 'auto', borderRadius: 999, padding: '0 14px', height: 44, fontSize: 14 }} onClick={() => flip(g, 'need')}>{t('grocery.need_again') || 'Need again'}</button>
                  </div>
                ))}
              </div>
            ),
          }]} />
        </div>
      ) : null}

      {edit ? <ItemSheet item={edit} onClose={() => setEdit(null)} onDone={changed} /> : null}
    </div>
  );
}
