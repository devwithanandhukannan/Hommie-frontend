'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { post, put, del } from '@/lib/api';
import { useAuth, useData } from '@/lib/auth';
import { Avatar, Badge, Btn, Empty, ErrorNote, Field, Icon, Input, MemberSelect, PageHeader, Select, Sheet, Spinner, useAction } from '@/components/ui';
import { longDate, shortDate, todayStr, rupees, toPaise } from '@/lib/format';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getEventVisual(ev) {
  const t = (ev.title || '').toLowerCase();
  const kind = (ev.kind || '').toLowerCase();
  const type = ev.type;
  const status = (ev.status || '').toLowerCase();

  // 1. BRAND SUBSCRIPTIONS (Netflix, Spotify, Apple TV, ChatGPT)
  if (/netflix/i.test(t)) {
    return { bg: '#000000', color: '#E50914', dot: status === 'paid' ? '#10B981' : '#06B6D4', brand: 'netflix', shape: 'squircle' };
  }
  if (/spotify/i.test(t)) {
    return { bg: '#1DB954', color: '#FFFFFF', dot: status === 'paid' ? '#10B981' : '#06B6D4', brand: 'spotify', shape: 'squircle' };
  }
  if (/apple|icloud|apple\s*tv/i.test(t)) {
    return { bg: '#000000', color: '#FFFFFF', dot: status === 'paid' ? '#10B981' : '#06B6D4', brand: 'apple', shape: 'squircle' };
  }
  if (/chatgpt|openai/i.test(t)) {
    return { bg: '#10A37F', color: '#FFFFFF', dot: status === 'paid' ? '#10B981' : '#06B6D4', brand: 'chatgpt', shape: 'squircle' };
  }

  // 2. BILLS & BILL PAYMENTS (Distinct Squircle Shape + Bold Rupee / Receipt / Utility Glyphs)
  if (type === 'bill' || type === 'loan_emi') {
    // Bill Payment (PAID bill status)
    if (status === 'paid') {
      return {
        bg: '#FEF3C7',
        color: '#B45309',
        dot: '#10B981',
        icon: 'rupee_paid', // Dedicated Paid Rupee sign with green checkmark seal
        shape: 'squircle',
      };
    }

    // Specific utility bills (unpaid / due)
    if (kind === 'electricity' || /electric|power|current|kseb|bescom|tneb/i.test(t)) {
      return { bg: '#FEF3C7', color: '#D97706', dot: '#F59E0B', icon: 'bolt', shape: 'squircle' };
    }
    if (kind === 'water' || /water|jal/i.test(t)) {
      return { bg: '#E0F2FE', color: '#0284C7', dot: '#0284C7', icon: 'water', shape: 'squircle' };
    }
    if (kind === 'internet' || /wifi|broadband|airtel|jio|act|fibernet/i.test(t)) {
      return { bg: '#F3E8FF', color: '#7C3AED', dot: '#7C3AED', icon: 'wifi', shape: 'squircle' };
    }
    if (kind === 'phone' || /phone|mobile|recharge/i.test(t)) {
      return { bg: '#DCFCE7', color: '#16A34A', dot: '#16A34A', icon: 'phone', shape: 'squircle' };
    }
    if (kind === 'gas' || /gas|lpg|cylinder|indane|hp/i.test(t)) {
      return { bg: '#FFEDD5', color: '#EA580C', dot: '#EA580C', icon: 'flame', shape: 'squircle' };
    }
    if (kind === 'rent' || /rent|maintenance|house|flat/i.test(t)) {
      return { bg: '#EEF2FF', color: '#4F46E5', dot: '#6366F1', icon: 'home', shape: 'squircle' };
    }
    if (type === 'loan_emi' || /emi|loan|credit\s*card/i.test(t)) {
      return { bg: '#FFE4E6', color: '#E11D48', dot: '#F43F5E', icon: 'card', shape: 'squircle' };
    }
    // Generic Due Bill
    return { bg: '#FEF3C7', color: '#B45309', dot: '#EF4444', icon: 'bill_due', shape: 'squircle' };
  }

  // 3. TASKS & CHORES (Always Distinct Circle Shape + Checklist / Checkmark / Sparkle Glyphs)
  if (type === 'task') {
    // Completed Task
    if (status === 'done') {
      return {
        bg: '#EFF6FF',
        color: '#1D4ED8',
        dot: '#3B82F6',
        icon: 'task_done',
        shape: 'circle',
      };
    }
    // Cleaning & Chores
    if (kind === 'chore' || /clean|wash|tidy|sweep|mop|bathroom|kitchen|trash|laundry/i.test(t)) {
      return {
        bg: '#EDE9FE',
        color: '#6D28D9',
        dot: '#8B5CF6',
        icon: 'chore', // Sparkles
        shape: 'circle',
      };
    }
    // Shopping / Grocery task
    if (/buy|shop|grocery|market|store/i.test(t)) {
      return {
        bg: '#ECFDF5',
        color: '#047857',
        dot: '#10B981',
        icon: 'cart',
        shape: 'circle',
      };
    }
    // Call / Meeting
    if (/call|doctor|meet|appointment/i.test(t)) {
      return {
        bg: '#F5F3FF',
        color: '#7C3AED',
        dot: '#8B5CF6',
        icon: 'call',
        shape: 'circle',
      };
    }
    // General Open Task
    return {
      bg: '#DBEAFE',
      color: '#1D4ED8',
      dot: '#3B82F6',
      icon: 'task_open', // Checkbox box
      shape: 'circle',
    };
  }

  // 4. MEALS
  if (type === 'meal') {
    if (ev.slot === 'morning' || /breakfast|morning/i.test(t)) {
      return { bg: '#FEF3C7', color: '#D97706', dot: '#F59E0B', icon: 'coffee' };
    }
    if (ev.slot === 'night' || /dinner|night/i.test(t)) {
      return { bg: '#F3E8FF', color: '#7C3AED', dot: '#8B5CF6', icon: 'bowl' };
    }
    return { bg: '#FFEDD5', color: '#C2410C', dot: '#F97316', icon: 'meals' };
  }

  // 5. MEDICINE
  if (type === 'medicine') {
    return { bg: '#FFE4E6', color: '#E11D48', dot: '#F43F5E', icon: 'pill' };
  }

  // 6. SPECIAL DAYS (Birthday, Anniversary, Vacation)
  if (type === 'special_day' || /birthday|anniversary|trip|travel|tour/i.test(t)) {
    if (/birthday|bday/i.test(t)) {
      return { bg: '#FCE7F3', color: '#BE185D', dot: '#EC4899', icon: 'cake' };
    }
    if (/anniversary/i.test(t)) {
      return { bg: '#FEE2E2', color: '#B91C1C', dot: '#EF4444', icon: 'heart' };
    }
    if (/trip|travel|vacation|boat|tour/i.test(t)) {
      return { bg: '#CCFBF1', color: '#0F766E', dot: '#0D9488', icon: 'boat' };
    }
    return { bg: '#FEF08A', color: '#A16207', dot: '#EAB308', icon: 'star' };
  }

  // 7. GUESTS
  if (type === 'guest') {
    return { bg: '#CCFBF1', color: '#0F766E', dot: '#0D9488', icon: 'family' };
  }

  // 8. DOCUMENTS
  if (type === 'document') {
    return { bg: '#FEF3C7', color: '#B45309', dot: '#F59E0B', icon: 'docs' };
  }

  return { bg: '#F3F4F6', color: '#4B5563', dot: '#6B7280', icon: 'calendar' };
}

export function EventBadge({ event, size = 22, showDot = true }) {
  const v = getEventVisual(event);
  const isSquircle = v.shape === 'squircle';
  const radius = isSquircle ? Math.round(size * 0.28) : '50%';

  let glyph = null;
  if (v.brand === 'netflix') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M4 2v20l8-10.5V20h4V2L8 12.5V2H4z" fill="#E50914" />
      </svg>
    );
  } else if (v.brand === 'spotify') {
    glyph = (
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.208-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.335.132-.67.467-.746 3.808-.87 7.076-.496 9.721 1.12.294.18.387.562.208.849zm1.223-2.72c-.226.367-.707.483-1.074.257-2.69-1.653-6.79-2.133-9.972-1.168-.413.125-.85-.11-1.075-.523-.125-.413.11-.85.523-1.075 3.633-1.103 8.147-.568 11.24 1.334.368.226.483.707.258 1.075zm.104-2.825C14.692 8.948 9.38 8.773 6.29 9.71c-.494.15-1.022-.132-1.172-.626-.15-.494.132-1.022.626-1.172 3.553-1.078 9.42-.876 13.14 1.334.444.263.589.84.326 1.284-.263.444-.84.589-1.284.326z" />
      </svg>
    );
  } else if (v.brand === 'apple') {
    glyph = (
      <span style={{ fontSize: size * 0.48, fontWeight: 800, lineHeight: 1, letterSpacing: -0.5 }}>
        tv
      </span>
    );
  } else if (v.brand === 'chatgpt') {
    glyph = (
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8 M8 12h8" />
      </svg>
    );
  } else if (v.icon === 'rupee_paid' || v.icon === 'paid') {
    // Paid Bill: Bold Indian Rupee ₹ with green checkmark seal
    glyph = (
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3.5h11 M5 7.5h8 M5 3.5a4 4 0 0 1 0 8h2l5 9" strokeWidth="2.4" />
        <circle cx="17.5" cy="16.5" r="4.8" fill="#16A34A" stroke="#FEF3C7" strokeWidth="1.2" />
        <polyline points="15.5 16.5 17 18 20 15" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  } else if (v.icon === 'bill_due') {
    // Due bill: Invoice voucher with Rupee symbol
    glyph = (
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 3h16a1 1 0 0 1 1 1v16l-3-1.5L15 20l-3-1.5L9 20l-3-1.5L3 20V4a1 1 0 0 1 1-1z" strokeWidth="1.8" />
        <path d="M8 7h8 M8 10h6 M8 7a2.2 2.2 0 0 1 0 4.4h1l3 4.6" strokeWidth="1.8" />
      </svg>
    );
  } else if (v.icon === 'task_open') {
    // Open task: Checkbox with check outline
    glyph = (
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    );
  } else if (v.icon === 'task_done' || v.icon === 'check') {
    // Completed task: Solid checkmark
    glyph = (
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  } else if (v.icon === 'chore') {
    // Chores / Cleaning: Sparkles
    glyph = (
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 5 5.6.8-4 4 1 5.6-5-2.6-5 2.6 1-5.6-4-4 5.6-.8z" />
      </svg>
    );
  } else if (v.icon === 'bolt') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z" />
      </svg>
    );
  } else if (v.icon === 'water') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    );
  } else if (v.icon === 'wifi') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0 M1.42 9a16 16 0 0 1 21.16 0 M8.53 16.11a6 6 0 0 1 6.95 0 M12 20h.01" />
      </svg>
    );
  } else if (v.icon === 'phone') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <path d="M12 18h.01" />
      </svg>
    );
  } else if (v.icon === 'flame') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2c-.5 2-2 3.5-3 5.5-1.5 3-1 6 1 8.5 2 2.5 5 2.5 6.5 0 2-3 1-6.5-.5-9C14.5 4.5 13.5 3 12 2z" />
      </svg>
    );
  } else if (v.icon === 'home') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20V9.5z" />
      </svg>
    );
  } else if (v.icon === 'card') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    );
  } else if (v.icon === 'cart') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    );
  } else if (v.icon === 'call') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    );
  } else if (v.icon === 'coffee') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1 M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z M6 1v3 M10 1v3 M14 1v3" />
      </svg>
    );
  } else if (v.icon === 'bowl') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11h16a8 8 0 0 1-16 0z M8 4v3 M12 3v4 M16 4v3" />
      </svg>
    );
  } else if (v.icon === 'cake') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8 M4 21h16 M12 7V4 M12 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
      </svg>
    );
  } else if (v.icon === 'heart') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  } else if (v.icon === 'star') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="currentColor">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    );
  } else if (v.icon === 'pill') {
    glyph = (
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.5 13.5l-5.7 5.7a4 4 0 0 1-5.6-5.6l5.7-5.7 M8.5 7.5l5.7-5.7a4 4 0 0 1 5.6 5.6l-5.7 5.7 M7.5 16.5l9-9" />
      </svg>
    );
  } else if (v.icon === 'boat') {
    glyph = (
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 19c3 2 9 2 12 0 M12 3v13 M12 5l7 11h-7 M12 7L6 16h6" />
      </svg>
    );
  } else {
    glyph = <Icon name={v.icon || 'calendar'} size={size * 0.55} />;
  }

  return (
    <div
      className={`cal-event-badge ${isSquircle ? 'squircle' : 'circle'}`}
      style={{
        width: size,
        height: size,
        backgroundColor: v.bg,
        color: v.color,
        borderRadius: radius,
      }}
    >
      {glyph}
      {showDot && v.dot ? (
        <span className="cal-event-badge-dot" style={{ backgroundColor: v.dot }} />
      ) : null}
    </div>
  );
}

function AddTaskSheet({ initialDate, onClose, onDone }) {
  const { family, t, lang } = useAuth();
  const [f, setF] = useState({ title: '', dueDate: initialDate || todayStr(), assigneeId: null, kind: 'custom' });
  const [run, busy] = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    if (await run(() => post('/tasks', { title: f.title, dueDate: f.dueDate, assigneeId: f.assigneeId, kind: f.kind }), 'Task added')) {
      onDone(); onClose();
    }
  };
  return (
    <Sheet title={`${t('tasks.new')} · ${shortDate(initialDate, lang)}`} onClose={onClose}>
      <form className="col" onSubmit={save} style={{ gap: 14 }}>
        <Field label={t('tasks.field_what')}>{(id) => <Input id={id} required maxLength={140} value={f.title} onChange={set('title')} placeholder="e.g. Call electrician, Pay WiFi" />}</Field>
        <Field label={t('tasks.field_due')}>{(id) => <Input id={id} type="date" value={f.dueDate} onChange={set('dueDate')} />}</Field>
        <Field label={t('tasks.field_assign')}>{(id) => <MemberSelect id={id} members={family.members} value={f.assigneeId} onChange={(v) => setF({ ...f, assigneeId: v })} allowNone noneLabel={t('tasks.unassigned')} />}</Field>
        <Field label={t('tasks.field_type')}>{(id) => <Select id={id} value={f.kind} onChange={set('kind')}><option value="custom">{t('tasks.type_task')}</option><option value="chore">{t('tasks.type_chore')}</option></Select>}</Field>
        <Btn type="submit" disabled={busy}>{t('tasks.add_btn')}</Btn>
      </form>
    </Sheet>
  );
}

function AddMealSheet({ initialDate, onClose, onDone }) {
  const { family, t, lang } = useAuth();
  const { data: recipes } = useData('/recipes');
  const [slot, setSlot] = useState('morning');
  const [items, setItems] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [cookId, setCookId] = useState(null);
  const [run, busy] = useAction();

  const save = async (e) => {
    e.preventDefault();
    const list = items.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12);
    if (await run(() => put(`/meals/${initialDate}/${slot}`, { items: list, recipeId: recipeId || null, cookId }), 'Meal planned')) {
      onDone(); onClose();
    }
  };

  return (
    <Sheet title={`${t('meals.plan')} · ${shortDate(initialDate, lang)}`} onClose={onClose}>
      <form className="col" onSubmit={save} style={{ gap: 14 }}>
        <Field label={t('meals.slot')}>
          {(id) => (
            <Select id={id} value={slot} onChange={(e) => setSlot(e.target.value)}>
              <option value="morning">{t('meals.morning')}</option>
              <option value="noon">{t('meals.noon')}</option>
              <option value="night">{t('meals.night')}</option>
            </Select>
          )}
        </Field>
        <Field label={t('meals.whats_cooking')} hint={t('meals.dishes_hint')}>
          {(id) => <Input id={id} value={items} onChange={(e) => setItems(e.target.value)} placeholder="e.g. Dosa, coconut chutney" required={!recipeId} />}
        </Field>
        <Field label={t('meals.recipe_optional')}>
          {(id) => (
            <Select id={id} value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
              <option value="">None</option>
              {(recipes || []).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t('meals.cook')}>
          {(id) => <MemberSelect id={id} members={family.members} value={cookId} onChange={setCookId} allowNone noneLabel={t('meals.anyone_cook')} />}
        </Field>
        <Btn type="submit" disabled={busy}>{t('btn.save')}</Btn>
      </form>
    </Sheet>
  );
}

function AmountSheet({ inst, onClose, onDone }) {
  const { t } = useAuth();
  const [v, setV] = useState('');
  const [run, busy] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const amount = toPaise(v);
    if (!amount) return;
    if (await run(() => post(`/bill-instances/${inst.id}/amount`, { amount }), 'Amount saved')) {
      onDone(); onClose();
    }
  };
  return (
    <Sheet title={`${inst.title} · ${t('money.field_amount')}`} onClose={onClose}>
      <form className="col" onSubmit={save} style={{ gap: 14 }}>
        <Field label={t('money.field_amount')}>
          {(id) => <Input id={id} inputMode="decimal" required value={v} onChange={(e) => setV(e.target.value)} placeholder="1840" autoFocus />}
        </Field>
        <Btn type="submit" disabled={busy}>{t('btn.save')}</Btn>
      </form>
    </Sheet>
  );
}

export default function CalendarPage() {
  const { family } = useAuth();
  const today = todayStr(family?.timezone);
  const [curMonth, setCurMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'list'
  const [modal, setModal] = useState(null);

  const { data, loading, error, reload } = useData(`/calendar?month=${curMonth}`, { interval: 60000 });
  const [run] = useAction();

  const [year, monthNum] = curMonth.split('-').map(Number);
  const monthDate = new Date(Date.UTC(year, monthNum - 1, 1));
  const monthTitle = monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const goMonth = (delta) => {
    const d = new Date(Date.UTC(year, monthNum - 1 + delta, 1));
    const nextYm = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    setCurMonth(nextYm);
  };

  const goToday = () => {
    const tYm = today.slice(0, 7);
    setCurMonth(tYm);
    setSelectedDate(today);
  };

  const gridCells = useMemo(() => {
    const firstDayIndex = new Date(Date.UTC(year, monthNum - 1, 1)).getUTCDay();
    const daysInCurMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(year, monthNum - 1, 0)).getUTCDate();

    const cells = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevM = monthNum === 1 ? 12 : monthNum - 1;
      const prevY = monthNum === 1 ? year - 1 : year;
      const dStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ date: dStr, dayNum: day, isCurrentMonth: false });
    }

    // Current month days
    for (let day = 1; day <= daysInCurMonth; day++) {
      const dStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ date: dStr, dayNum: day, isCurrentMonth: true });
    }

    // Next month padding to complete rows
    const remainder = cells.length % 7;
    if (remainder > 0) {
      const pad = 7 - remainder;
      for (let day = 1; day <= pad; day++) {
        const nextM = monthNum === 12 ? 1 : monthNum + 1;
        const nextY = monthNum === 12 ? year + 1 : year;
        const dStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        cells.push({ date: dStr, dayNum: day, isCurrentMonth: false });
      }
    }

    return cells;
  }, [year, monthNum]);

  const byDate = data?.byDate || {};

  const filterCounts = useMemo(() => {
    const counts = { all: 0, meal: 0, task: 0, bill: 0, special_day: 0, medicine: 0, other: 0 };
    for (const d in byDate) {
      for (const ev of byDate[d]) {
        counts.all++;
        if (counts[ev.type] !== undefined) counts[ev.type]++;
        else counts.other++;
      }
    }
    return counts;
  }, [byDate]);

  const selectedEvents = useMemo(() => {
    const list = byDate[selectedDate] || [];
    if (filter === 'all') return list;
    if (filter === 'other') return list.filter((e) => !['meal', 'task', 'bill', 'special_day', 'medicine'].includes(e.type));
    return list.filter((e) => e.type === filter);
  }, [byDate, selectedDate, filter]);

  const completeTask = (task) => run(async () => {
    await post(`/tasks/${task.id}/complete`, {});
    reload();
  }, 'Task completed');

  const recordMedicine = (m) => run(async () => {
    await post(`/medicines/${m.meta.medicineId}/logs`, { time: m.meta.time, status: 'given' });
    reload();
  }, 'Dose recorded');

  return (
    <div className="cal-container">
      {/* Page Header with Month Navigation */}
      <PageHeader title="Calendar" sub={family?.name}>
        <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
          <div className="row" style={{ background: 'var(--surface)', padding: '3px 8px', borderRadius: 999, border: '1px solid var(--line)' }}>
            <button type="button" className="icon-btn" style={{ width: 30, height: 30, border: 0 }} aria-label="Previous month" onClick={() => goMonth(-1)}>
              ‹
            </button>
            <span style={{ fontWeight: 700, padding: '0 8px', minWidth: 130, textAlign: 'center', fontSize: 14 }}>
              {monthTitle}
            </span>
            <button type="button" className="icon-btn" style={{ width: 30, height: 30, border: 0 }} aria-label="Next month" onClick={() => goMonth(1)}>
              ›
            </button>
          </div>
          <Btn tone="ghost" size="sm" onClick={goToday}>Today</Btn>
          <div className="tabs" style={{ padding: 2 }}>
            <button type="button" aria-selected={viewMode === 'month'} onClick={() => setViewMode('month')}>Month</button>
            <button type="button" aria-selected={viewMode === 'list'} onClick={() => setViewMode('list')}>Schedule</button>
          </div>
        </div>
      </PageHeader>

      {/* Filter Tabs */}
      <div className="cal-filter-bar" role="tablist" aria-label="Filter calendar events">
        {[
          ['all', 'All', filterCounts.all],
          ['task', 'Tasks', filterCounts.task],
          ['bill', 'Bills', filterCounts.bill],
          ['meal', 'Meals', filterCounts.meal],
          ['special_day', 'Events', filterCounts.special_day],
          ['medicine', 'Medicine', filterCounts.medicine],
        ].map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            className={`cal-filter-pill ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label} <span className="cal-pill-count">{count}</span>
          </button>
        ))}
      </div>

      {loading && !data ? <Spinner /> : error ? <ErrorNote error={error} /> : (
        <>
          {viewMode === 'month' ? (
            <div className="cal-view-row">
              {/* Calendar Monthly Grid (Reference Image 1 Squircle Tiles) */}
              <div className="card grow cal-main-card">
                {/* Weekday column names */}
                <div className="cal-grid" style={{ marginBottom: 6 }}>
                  {WEEKDAYS.map((wd) => (
                    <div key={wd} className="cal-weekday">{wd}</div>
                  ))}
                </div>

                {/* Day squircle cards */}
                <div className="cal-grid">
                  {gridCells.map(({ date, dayNum, isCurrentMonth }) => {
                    const isToday = date === today;
                    const isSelected = date === selectedDate;
                    const dayEvents = (byDate[date] || []).filter((e) => filter === 'all' || e.type === filter);

                    // Show up to 2 distinct event badges stacked one over the other
                    const displayEvents = dayEvents.slice(0, 2);
                    const remainingCount = dayEvents.length - 2;

                    return (
                      <button
                        key={date}
                        type="button"
                        className={`cal-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedDate(date)}
                        aria-label={`${longDate(date)}, ${dayEvents.length} events`}
                        aria-pressed={isSelected}
                      >
                        {/* Top: Colorful Event Icons Stacked One Over Other */}
                        <div className="cal-tile-top">
                          {displayEvents.length > 0 ? (
                            <div className="cal-icon-stack">
                              {displayEvents.map((ev, idx) => (
                                <div
                                  key={ev.id || idx}
                                  className="cal-stacked-badge"
                                  style={{
                                    zIndex: displayEvents.length - idx,
                                    marginLeft: idx === 0 ? 0 : -6,
                                  }}
                                  title={`${ev.title} (${ev.type})`}
                                >
                                  <EventBadge event={ev} size={22} showDot={true} />
                                </div>
                              ))}
                              {remainingCount > 0 ? (
                                <span className="cal-more-badge" style={{ zIndex: 10, marginLeft: -5 }}>
                                  +{remainingCount}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {/* Bottom: Date number (Reference 1 style) */}
                        <div className="cal-tile-bottom">
                          <span className={`cal-day-num ${isToday ? 'today-pill' : ''}`}>
                            {dayNum}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Day Agenda Panel (Right / Below) */}
              <div className="card col cal-agenda-card">
                <div className="row between" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 18, margin: 0 }}>{shortDate(selectedDate)}</h2>
                    <span className="small muted">
                      {longDate(selectedDate)} {selectedDate === today && <Badge tone="info">Today</Badge>}
                    </span>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <Btn size="sm" tone="ghost" onClick={() => setModal('task')}>+ Task</Btn>
                    <Btn size="sm" tone="ghost" onClick={() => setModal('meal')}>+ Meal</Btn>
                  </div>
                </div>

                {/* Selected Day's Events List */}
                {selectedEvents.length === 0 ? (
                  <Empty>
                    <p style={{ margin: '0 0 12px' }}>Nothing scheduled for this day.</p>
                    <div className="row center" style={{ justifyContent: 'center', gap: 8 }}>
                      <Btn size="sm" onClick={() => setModal('task')}>Add task</Btn>
                      <Btn size="sm" tone="ghost" onClick={() => setModal('meal')}>Plan meal</Btn>
                    </div>
                  </Empty>
                ) : (
                  <div className="list" style={{ marginTop: 8 }}>
                    {selectedEvents.map((ev) => (
                      <div key={ev.id} className="item" style={{ alignItems: 'flex-start', padding: '12px 0' }}>
                        {/* Event signature colorful icon */}
                        <div style={{ marginTop: 2 }}>
                          <EventBadge event={ev} size={30} showDot={false} />
                        </div>

                        {/* Title and details */}
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="row between wrap" style={{ gap: 4 }}>
                            <span className="bold" style={{ textDecoration: ev.status === 'done' ? 'line-through' : 'none', fontSize: 14.5 }}>
                              {ev.title}
                            </span>
                            {ev.subtitle ? (
                              <span className="small muted" style={{ fontWeight: 600 }}>{ev.subtitle}</span>
                            ) : null}
                          </div>

                          <div className="row wrap" style={{ gap: 6, marginTop: 4, alignItems: 'center' }}>
                            {ev.type === 'bill' || ev.type === 'loan_emi' ? (
                              <span style={{ background: '#FEF3C7', color: '#B45309', borderRadius: 6, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
                                Bill
                              </span>
                            ) : ev.type === 'task' ? (
                              <span style={{ background: '#EFF6FF', color: '#1D4ED8', borderRadius: 6, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
                                Task
                              </span>
                            ) : ev.type === 'meal' ? (
                              <span style={{ background: '#FFF7ED', color: '#C2410C', borderRadius: 6, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
                                Meal
                              </span>
                            ) : null}
                            {ev.person ? <span className="small muted">{ev.person.displayName}</span> : null}
                            {ev.status === 'done' ? <Badge tone="ok">Done</Badge> : null}
                            {ev.status === 'paid' ? <Badge tone="ok">Paid</Badge> : null}
                            {ev.status === 'pending' ? <Badge tone="warn">Due</Badge> : null}
                            {ev.status === 'awaiting_amount' ? <Badge tone="danger">Need amount</Badge> : null}
                          </div>
                        </div>

                        {/* Quick action buttons */}
                        <div className="row" style={{ gap: 6 }}>
                          {ev.type === 'task' && ev.status !== 'done' && (
                            <button
                              type="button"
                              className="btn sm"
                              style={{ padding: '4px 10px', fontSize: 12 }}
                              onClick={() => completeTask(ev)}
                            >
                              Done
                            </button>
                          )}
                          {ev.status === 'awaiting_amount' && (
                            <Btn size="sm" onClick={() => setModal({ type: 'amount', inst: ev })}>
                              Add amount
                            </Btn>
                          )}
                          {ev.link && (
                            <Link href={ev.link} className="btn ghost sm" style={{ padding: '4px 8px', fontSize: 12 }}>
                              View ›
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Schedule List View */
            <div className="card col" style={{ maxWidth: 800, margin: '0 auto', borderRadius: 24, padding: 20 }}>
              <h2 style={{ fontSize: 18, marginBottom: 12 }}>{monthTitle} Schedule</h2>
              {Object.keys(byDate).sort().length === 0 ? (
                <Empty>No events scheduled for {monthTitle}.</Empty>
              ) : (
                Object.keys(byDate).sort().map((d) => {
                  const evs = byDate[d].filter((e) => filter === 'all' || e.type === filter);
                  if (evs.length === 0) return null;
                  return (
                    <div key={d} style={{ marginBottom: 18 }}>
                      <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                        <span className="bold" style={{ fontSize: 15 }}>{shortDate(d)}</span>
                        <span className="tiny muted">{longDate(d)}</span>
                        {d === today && <Badge tone="info">Today</Badge>}
                      </div>
                      <div className="card list" style={{ padding: '4px 12px' }}>
                        {evs.map((ev) => (
                          <div key={ev.id} className="item" style={{ padding: '10px 0' }}>
                            <EventBadge event={ev} size={28} showDot={false} />
                            <div className="grow">
                              <div className="bold">{ev.title}</div>
                              <div className="small muted">{ev.subtitle || ev.type}</div>
                            </div>
                            {ev.link && <Link href={ev.link} className="btn ghost sm">Open ›</Link>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* Sheets / Modals */}
      {modal === 'task' && <AddTaskSheet initialDate={selectedDate} onClose={() => setModal(null)} onDone={reload} />}
      {modal === 'meal' && <AddMealSheet initialDate={selectedDate} onClose={() => setModal(null)} onDone={reload} />}
      {modal?.type === 'amount' && <AmountSheet inst={modal.inst} onClose={() => setModal(null)} onDone={reload} />}
    </div>
  );
}
