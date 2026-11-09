'use client';
import { useEffect, useRef, useState } from 'react';
import { post, patch, del } from '@/lib/api';
import { useAuth, useData, notifyChanged } from '@/lib/auth';
import { Btn, Empty, ErrorNote, Field, Icon, Input, Sheet, Spinner, UnitButtons, parseQty, formatQty, useAction, useToast } from '@/components/ui';
import { toPaise, timeAgo } from '@/lib/format';

function ItemSheet({ item, onClose, onDone }) {
  const { t } = useAuth();
  const [name, setName] = useState(item.name);
  const parsed = parseQty(item.qty);
  const [amount, setAmount] = useState(parsed.amount);
  const [unit, setUnit] = useState(parsed.unit);
  const [price, setPrice] = useState(item.lastPrice ? String(item.lastPrice / 100) : '');
  const [run, busy] = useAction();

  const save = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    const finalQty = formatQty(amount, unit);
    const ok = await run(async () => {
      if (cleanName !== item.name || finalQty !== (item.qty || '')) {
        await patch(`/grocery/${item.id}`, { name: cleanName, qty: finalQty || undefined });
      }
      const p = toPaise(price);
      // Recording the cost also adds it to the family expenses (split equally); repeating it only corrects that expense.
      if (p && p !== item.lastPrice) {
        await post(`/grocery/${item.id}/price`, { price: p });
      }
    });
    if (ok) { onDone(); onClose(); }
  };
  const remove = async () => { if (await run(() => del(`/grocery/${item.id}`))) { onDone(); onClose(); } };

  return (
    <Sheet title={item.name} onClose={onClose}>
      <form className="col" onSubmit={save} style={{ gap: 14 }}>
        <Field label={t('add.grocery')}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />}
        </Field>
        <Field label={t('grocery.field_qty') || 'Quantity'}>
          {(id) => (
            <div className="col" style={{ gap: 8 }}>
              <Input
                id={id}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="400, 2, 1.5…"
                maxLength={30}
              />
              <UnitButtons selected={unit} onSelect={setUnit} />
            </div>
          )}
        </Field>
        <Field label={`₹ ${t('add.amount')}`} hint="Added to the family expenses, split equally">
          {(id) => <Input id={id} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />}
        </Field>
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
  const [showStock, setShowStock] = useState(false);
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
        <div className="shop-list" role="list">
          {needed.map((g) => (
            <div className="shop-row" role="listitem" key={g.id}>
              <button
                type="button"
                className="moment-check"
                aria-label={`${g.name} ✓`}
                onClick={() => flip(g, 'bought')}
                title="Mark bought"
              >
                <Icon name="check" size={18} />
              </button>
              <button type="button" className="shop-name" onClick={() => setEdit(g)}>
                <span>{g.name}</span>
                {g.qty ? <span className="shop-qty">{g.qty}</span> : null}
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Edit ${g.name}`}
                onClick={() => setEdit(g)}
                title="Edit item"
                style={{ opacity: 0.55, flexShrink: 0 }}
              >
                <Icon name="edit" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {stocked.length ? (
        <>
          <button type="button" className="link-btn" style={{ marginTop: 14 }} onClick={() => setShowStock((v) => !v)} aria-expanded={showStock}>
            {showStock ? '▾' : '▸'} {t('grocery.in_stock') || 'In stock'} ({stocked.length})
          </button>
          {showStock ? (
            <div className="shop-list" role="list">
              {stocked.map((g) => (
                <div className="shop-row is-stock" role="listitem" key={g.id}>
                  <button
                    type="button"
                    className="moment-check done"
                    aria-label={`${g.name} in stock`}
                    onClick={() => flip(g, 'need')}
                    title="Move back to needed"
                  >
                    <Icon name="check" size={18} />
                  </button>
                  <button type="button" className="shop-name" onClick={() => setEdit(g)}>
                    <span>{g.name}</span>
                    {g.qty ? <span className="shop-qty">{g.qty}</span> : null}
                    {g.lastPrice ? <span className="shop-qty price-pill">₹{Math.round(g.lastPrice / 100)}</span> : null}
                    {g.lastBought?.at ? <span className="shop-qty">· {timeAgo(g.lastBought.at)}</span> : null}
                  </button>
                  <button
                    type="button"
                    className="moment-act ghost"
                    onClick={() => flip(g, 'need')}
                    style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }}
                  >
                    {t('grocery.need_again') || 'Need again'}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Edit ${g.name}`}
                    onClick={() => setEdit(g)}
                    title="Edit item"
                    style={{ opacity: 0.55, flexShrink: 0 }}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {edit ? <ItemSheet item={edit} onClose={() => setEdit(null)} onDone={changed} /> : null}
    </div>
  );
}
