'use client';
import { useState } from 'react';
import { del, patch, post } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import {
  Badge,
  Btn,
  Empty,
  ErrorNote,
  Field,
  Icon,
  Input,
  PageHeader,
  Select,
  Sheet,
  Spinner,
  useAction,
  useConfirm,
  useToast,
} from '@/components/ui';
import { timeAgo, toPaise } from '@/lib/format';

export const UNITS = [
  { value: 'pcs', label: 'pcs (pieces)' },
  { value: 'kg', label: 'kg (kilogram)' },
  { value: 'g', label: 'g (gram)' },
  { value: 'L', label: 'L (liter)' },
  { value: 'ml', label: 'ml (milliliter)' },
  { value: 'pack', label: 'pack (packet)' },
  { value: 'doz', label: 'doz (dozen)' },
  { value: 'box', label: 'box' },
  { value: 'bottle', label: 'bottle' },
  { value: 'bunch', label: 'bunch' },
  { value: 'custom', label: 'Custom unit…' },
];

export const QUICK_UNITS = ['pcs', 'kg', 'g', 'L', 'ml', 'pack', 'doz'];

export function parseQty(qtyStr) {
  if (!qtyStr) return { amount: '', unit: 'pcs', custom: '' };
  const str = String(qtyStr).trim();
  const match = str.match(/^([\d.,/]+)\s*(.*)$/);
  if (!match) return { amount: '', unit: 'custom', custom: str };
  const amount = match[1];
  const unitRaw = match[2].trim().toLowerCase();
  if (!unitRaw) return { amount, unit: 'pcs', custom: '' };
  if (['kg', 'kgs'].includes(unitRaw)) return { amount, unit: 'kg', custom: '' };
  if (['g', 'gm', 'gms', 'gram', 'grams'].includes(unitRaw)) return { amount, unit: 'g', custom: '' };
  if (['l', 'ltr', 'liter', 'liters', 'litre', 'litres'].includes(unitRaw)) return { amount, unit: 'L', custom: '' };
  if (['ml', 'mls'].includes(unitRaw)) return { amount, unit: 'ml', custom: '' };
  if (['pc', 'pcs', 'piece', 'pieces', 'nos', 'count'].includes(unitRaw)) return { amount, unit: 'pcs', custom: '' };
  if (['pack', 'packs', 'pkt', 'pkts', 'packet', 'packets'].includes(unitRaw)) return { amount, unit: 'pack', custom: '' };
  if (['doz', 'dozen', 'dozens'].includes(unitRaw)) return { amount, unit: 'doz', custom: '' };
  if (['box', 'boxes'].includes(unitRaw)) return { amount, unit: 'box', custom: '' };
  if (['bottle', 'bottles', 'btl'].includes(unitRaw)) return { amount, unit: 'bottle', custom: '' };
  if (['bunch', 'bunches'].includes(unitRaw)) return { amount, unit: 'bunch', custom: '' };
  return { amount, unit: 'custom', custom: match[2].trim() };
}

export function formatQty(amount, unit, custom) {
  const cleanAmount = (amount || '').trim();
  if (!cleanAmount && !custom) return '';
  if (unit === 'custom') {
    const cleanCustom = (custom || '').trim();
    return cleanAmount && cleanCustom ? `${cleanAmount} ${cleanCustom}` : cleanAmount || cleanCustom;
  }
  return cleanAmount ? `${cleanAmount} ${unit}` : unit;
}

function BoughtSheet({ item, onClose, onDone }) {
  const { t } = useAuth();
  const [price, setPrice] = useState('');
  const [run, busy] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const body = {};
    const p = price ? toPaise(price) : null;
    if (price && !p) return;
    if (p) body.price = p;
    if (await run(() => post(`/grocery/${item.id}/bought`, body), 'Marked as bought')) {
      onDone();
      onClose();
    }
  };
  return (
    <Sheet title={`${t('grocery.bought')} · ${item.name}`} onClose={onClose}>
      <form className="col" onSubmit={save} style={{ gap: 14 }}>
        <p className="muted small" style={{ margin: 0 }}>
          {t('grocery.field_split')}
        </p>
        <Field label={t('grocery.field_price')}>
          {(id) => (
            <Input
              id={id}
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="120"
              autoFocus
            />
          )}
        </Field>
        <Btn type="submit" disabled={busy}>{t('btn.done')}</Btn>
      </form>
    </Sheet>
  );
}

function EditGrocerySheet({ item, onClose, onDone }) {
  const { t } = useAuth();
  const parsed = parseQty(item.qty);
  const [name, setName] = useState(item.name || '');
  const [amount, setAmount] = useState(parsed.amount || '');
  const [unit, setUnit] = useState(parsed.unit || 'pcs');
  const [customUnit, setCustomUnit] = useState(parsed.custom || '');
  const [run, busy] = useAction();

  const save = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    const cleanQty = formatQty(amount, unit, customUnit);
    if (await run(() => patch(`/grocery/${item.id}`, { name: cleanName, qty: cleanQty }), 'Item updated')) {
      onDone();
      onClose();
    }
  };

  return (
    <Sheet title={`${t('btn.edit')} · ${item.name}`} onClose={onClose}>
      <form className="col" onSubmit={save} style={{ gap: 14 }}>
        <Field label={t('recipes.field_name')}>
          {(id) => (
            <Input
              id={id}
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('grocery.placeholder_name')}
            />
          )}
        </Field>

        <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 110px' }}>
            <Field label={t('grocery.placeholder_qty')}>
              {(id) => (
                <Input
                  id={id}
                  maxLength={15}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="2, 500"
                />
              )}
            </Field>
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <Field label="Unit">
              {(id) => (
                <Select id={id} value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </div>

        {unit === 'custom' ? (
          <Field label="Custom reading label">
            {(id) => (
              <Input
                id={id}
                maxLength={20}
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                placeholder="cans, bunches"
              />
            )}
          </Field>
        ) : null}

        <div className="row wrap" style={{ gap: 6 }}>
          <span className="tiny muted" style={{ width: '100%' }}>{t('grocery.units_label')}</span>
          {QUICK_UNITS.map((u) => (
            <button
              key={u}
              type="button"
              className={`unit-chip ${unit === u ? 'active' : ''}`}
              onClick={() => setUnit(u)}
            >
              {u}
            </button>
          ))}
        </div>

        <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end', gap: 10 }}>
          <Btn tone="ghost" onClick={onClose}>{t('btn.cancel')}</Btn>
          <Btn type="submit" disabled={busy}>{t('tasks.save_btn')}</Btn>
        </div>
      </form>
    </Sheet>
  );
}

export default function GroceryPage() {
  const { family, t } = useAuth();
  const { data, error, loading, reload } = useData('/grocery', { interval: 20000 });
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const toast = useToast();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [customUnit, setCustomUnit] = useState('');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'

  const [buying, setBuying] = useState(null);
  const [editing, setEditing] = useState(null);

  // Drag and drop state
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null); // 'needed' | 'stocked'

  const add = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    const cleanQty = formatQty(amount, unit, customUnit);
    const body = { name: cleanName };
    if (cleanQty) body.qty = cleanQty;

    if (await run(() => post('/grocery', body), 'Added to grocery list')) {
      setName('');
      setAmount('');
      setCustomUnit('');
      reload();
    }
  };

  const removeItem = async (item) => {
    const ok = await confirm({
      title: `Remove ${item.name}?`,
      message: 'This will remove the item from your family grocery list.',
      confirmText: t('btn.remove'),
      tone: 'danger',
    });
    if (ok) {
      if (await run(() => del(`/grocery/${item.id}`), `Removed ${item.name}`)) {
        reload();
      }
    }
  };

  const markBought = async (item) => {
    if (await run(() => post(`/grocery/${item.id}/bought`, {}), `Marked ${item.name} as bought`)) {
      reload();
    }
  };

  const markNeeded = async (item) => {
    if (await run(() => post(`/grocery/${item.id}/need`, {}), `Added ${item.name} to needed`)) {
      reload();
    }
  };

  const items = data || [];
  const needed = items.filter((g) => g.status === 'needed');
  const stocked = items.filter((g) => g.status !== 'needed');

  const last = (g) =>
    g.lastBought
      ? `Last bought by ${g.lastBought.by?.displayName || '—'} ${timeAgo(g.lastBought.at)}`
      : 'Never bought yet';

  // Drag and Drop handlers
  const handleDragStart = (e, item) => {
    setDraggingId(item.id);
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e, targetCol) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== targetCol) {
      setDragOverCol(targetCol);
    }
  };

  const handleDrop = async (e, targetCol) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    setDragOverCol(null);
    setDraggingId(null);

    const item = items.find((g) => g.id === id);
    if (!item) return;

    if (targetCol === 'stocked' && item.status === 'needed') {
      await markBought(item);
    } else if (targetCol === 'needed' && item.status !== 'needed') {
      await markNeeded(item);
    }
  };

  return (
    <div className="grocery-page-wrap">
      <PageHeader title={t('grocery.title')} sub={family?.name}>
        <div className="row" style={{ gap: 6 }}>
          <button
            type="button"
            className={`btn sm ${viewMode === 'kanban' ? '' : 'ghost'}`}
            onClick={() => setViewMode('kanban')}
            title={t('grocery.kanban')}
          >
            <Icon name="kanban" size={16} /> {t('grocery.kanban')}
          </button>
          <button
            type="button"
            className={`btn sm ${viewMode === 'list' ? '' : 'ghost'}`}
            onClick={() => setViewMode('list')}
            title={t('grocery.list')}
          >
            <Icon name="list" size={16} /> {t('grocery.list')}
          </button>
        </div>
      </PageHeader>

      {/* Add Grocery Item Card with Unit Selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <form onSubmit={add} aria-label="Add grocery item">
          <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
            <Input
              aria-label="Item name"
              className="grow"
              style={{ minWidth: 160 }}
              maxLength={80}
              placeholder={t('grocery.placeholder_name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              aria-label="Quantity amount"
              style={{ width: 95 }}
              maxLength={15}
              placeholder={t('grocery.placeholder_qty')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Select
              aria-label="Quantity unit"
              style={{ width: 130 }}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </Select>
            {unit === 'custom' ? (
              <Input
                aria-label="Custom unit label"
                style={{ width: 110 }}
                maxLength={20}
                placeholder="unit"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
              />
            ) : null}
            <Btn type="submit" disabled={busy || !name.trim()}>
              <Icon name="plus" size={16} /> {t('grocery.add')}
            </Btn>
          </div>

          {/* Quick unit select pills */}
          <div className="row wrap" style={{ gap: 6, marginTop: 10, alignItems: 'center' }}>
            <span className="tiny muted">{t('grocery.units_label')}</span>
            {QUICK_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                className={`unit-chip ${unit === u ? 'active' : ''}`}
                onClick={() => setUnit(u)}
              >
                {u}
              </button>
            ))}
          </div>
        </form>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorNote error={error} />
      ) : viewMode === 'kanban' ? (
        /* ================= KANBAN BOARD VIEW ================= */
        <div className="kanban-grid" aria-label="Grocery Kanban Board">
          {/* Column 1: Needed */}
          <div
            className={`kanban-col ${dragOverCol === 'needed' ? 'drop-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, 'needed')}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, 'needed')}
          >
            <div className="kanban-col-head">
              <div className="row" style={{ gap: 8 }}>
                <span className="bold" style={{ fontSize: 16 }}>{t('grocery.needed')}</span>
                <Badge tone="warn">{needed.length}</Badge>
              </div>
              <span className="tiny muted">{t('grocery.drop_needed')}</span>
            </div>

            <div className="kanban-items-list" style={{ minHeight: 120 }}>
              {needed.length === 0 ? (
                <div className="empty" style={{ padding: '32px 16px' }}>
                  {t('grocery.empty_needed')}<br />
                  <span className="tiny muted">{t('grocery.drop_needed')}</span>
                </div>
              ) : (
                needed.map((g) => (
                  <div
                    key={g.id}
                    className={`kanban-card ${draggingId === g.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, g)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <span className="drag-handle" title="Drag to move">
                          <Icon name="drag" size={16} />
                        </span>
                        <div>
                          <div className="bold" style={{ fontSize: 15 }}>{g.name}</div>
                          <div className="tiny muted" style={{ marginTop: 2 }}>{last(g)}</div>
                        </div>
                      </div>
                      {g.qty ? <span className="qty-pill">{g.qty}</span> : null}
                    </div>

                    <div className="row between" style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--line-soft)' }}>
                      <button
                        type="button"
                        className="btn sm"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => setBuying(g)}
                        title="Mark bought and enter price"
                      >
                        <Icon name="check" size={14} /> {t('grocery.bought')}
                      </button>
                      <div className="row" style={{ gap: 4 }}>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${g.name}`}
                          onClick={() => setEditing(g)}
                          title="Edit item"
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Remove ${g.name}`}
                          onClick={() => removeItem(g)}
                          title="Remove item"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: In Stock */}
          <div
            className={`kanban-col ${dragOverCol === 'stocked' ? 'drop-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, 'stocked')}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, 'stocked')}
          >
            <div className="kanban-col-head">
              <div className="row" style={{ gap: 8 }}>
                <span className="bold" style={{ fontSize: 16 }}>{t('grocery.in_stock')}</span>
                <Badge tone="ok">{stocked.length}</Badge>
              </div>
              <span className="tiny muted">{t('grocery.drop_bought')}</span>
            </div>

            <div className="kanban-items-list" style={{ minHeight: 120 }}>
              {stocked.length === 0 ? (
                <div className="empty" style={{ padding: '32px 16px' }}>
                  {t('grocery.empty_stock')}<br />
                  <span className="tiny muted">{t('grocery.drag_here')}</span>
                </div>
              ) : (
                stocked.map((g) => (
                  <div
                    key={g.id}
                    className={`kanban-card ${draggingId === g.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, g)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <span className="drag-handle" title="Drag to move">
                          <Icon name="drag" size={16} />
                        </span>
                        <div>
                          <div className="bold" style={{ fontSize: 15 }}>{g.name}</div>
                          <div className="tiny muted" style={{ marginTop: 2 }}>
                            {last(g)}{g.avgIntervalDays ? ` · every ${Math.round(g.avgIntervalDays)}d` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                        {g.qty ? <span className="qty-pill">{g.qty}</span> : null}
                        {g.likelyLow ? <Badge tone="warn">{t('grocery.low')}</Badge> : null}
                      </div>
                    </div>

                    <div className="row between" style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--line-soft)' }}>
                      <button
                        type="button"
                        className="btn ghost sm"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => markNeeded(g)}
                        title="Add back to needed"
                      >
                        {t('grocery.need_again')}
                      </button>
                      <div className="row" style={{ gap: 4 }}>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Edit ${g.name}`}
                          onClick={() => setEditing(g)}
                          title="Edit item"
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Remove ${g.name}`}
                          onClick={() => removeItem(g)}
                          title="Remove item"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ================= CLASSIC LIST VIEW ================= */
        <>
          <h2 style={{ marginTop: 20 }}>{t('grocery.needed')} ({needed.length})</h2>
          {needed.length === 0 ? (
            <Empty>{t('grocery.empty_needed')}</Empty>
          ) : (
            <div className="card list">
              {needed.map((g) => (
                <div key={g.id} className="item">
                  <button
                    type="button"
                    className="circle"
                    aria-label={`Mark ${g.name} bought`}
                    onClick={() => setBuying(g)}
                  >
                    <span />
                  </button>
                  <div className="grow">
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span className="bold">{g.name}</span>
                      {g.qty ? <span className="qty-pill">{g.qty}</span> : null}
                    </div>
                    <div className="small muted">{last(g)}</div>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Edit ${g.name}`}
                      onClick={() => setEditing(g)}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <Btn tone="ghost" size="sm" onClick={() => removeItem(g)}>
                      {t('btn.remove')}
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 style={{ marginTop: 24 }}>{t('grocery.in_stock')} ({stocked.length})</h2>
          {stocked.length === 0 ? (
            <Empty>{t('grocery.empty_stock')}</Empty>
          ) : (
            <div className="card list">
              {stocked.map((g) => (
                <div key={g.id} className="item">
                  <div className="grow">
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span className="bold">{g.name}</span>
                      {g.qty ? <span className="qty-pill">{g.qty}</span> : null}
                      {g.likelyLow ? <Badge tone="warn">{t('grocery.low')}</Badge> : null}
                    </div>
                    <div className="small muted">
                      {last(g)}{g.avgIntervalDays ? ` · about every ${Math.round(g.avgIntervalDays)} days` : ''}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <Btn size="sm" tone="ghost" onClick={() => markNeeded(g)}>
                      {t('grocery.need_again')}
                    </Btn>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Edit ${g.name}`}
                      onClick={() => setEditing(g)}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove ${g.name}`}
                      onClick={() => removeItem(g)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Bought Price Sheet */}
      {buying ? (
        <BoughtSheet item={buying} onClose={() => setBuying(null)} onDone={reload} />
      ) : null}

      {/* Edit Grocery Sheet */}
      {editing ? (
        <EditGrocerySheet item={editing} onClose={() => setEditing(null)} onDone={reload} />
      ) : null}
    </div>
  );
}
