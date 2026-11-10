import { todayStr, addDaysStr, shortDate } from '@/lib/format';

/**
 * Shared client-side helpers for Hommi AI action cards, human grouping,
 * meaningful button copy, and /ai/apply payload sanitization.
 */

export function sanitizeAiActions(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.map((a) => ({
    type: a.type || 'grocery',
    title: String(a.title || '').trim().slice(0, 140),
    quantity: a.quantity ? String(a.quantity).slice(0, 60) : null,
    category: a.category ? String(a.category).slice(0, 50) : null,
    shop: a.shop ? String(a.shop).slice(0, 60) : null,
    amount: typeof a.amount === 'number' && Number.isFinite(a.amount) ? a.amount : null,
    dueDate: a.dueDate || undefined,
    slot: a.slot || undefined,
    date: a.date || undefined,
    cookName: a.cookName || undefined,
    assigneeName: a.assigneeName || undefined,
    targetId: a.targetId || undefined,
    ingredients: Array.isArray(a.ingredients) ? a.ingredients : undefined,
    steps: Array.isArray(a.steps) ? a.steps : undefined,
  }));
}

export function actionKind(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('delete')) return 'delete';
  if (t.includes('recipe')) return 'recipe';
  if (t.includes('meal')) return 'meal';
  if (t.includes('grocery')) return 'grocery';
  if (t.includes('calendar')) return 'calendar';
  if (t.includes('expense')) return 'expense';
  if (t.includes('bill')) return 'bill';
  if (t.includes('medicine')) return 'medicine';
  return 'task';
}

export function actionIconName(type) {
  const kind = actionKind(type);
  if (kind === 'grocery') return 'cart';
  if (kind === 'recipe') return 'recipes';
  if (kind === 'meal') return 'meals';
  if (kind === 'calendar') return 'calendar';
  if (kind === 'delete') return 'trash';
  if (kind === 'expense') return 'money';
  if (kind === 'bill') return 'bills';
  if (kind === 'medicine') return 'med';
  return 'tasks';
}

export function actionTypeLabel(type, lang = 'en') {
  const ml = lang === 'ml';
  const kind = actionKind(type);
  if (kind === 'recipe') return ml ? 'പാചകക്കുറിപ്പിൽ സേവ്' : 'Save to Recipe';
  if (kind === 'meal') return ml ? 'ഭക്ഷണ പ്ലാനിൽ' : 'Save to Meals';
  if (kind === 'grocery') return ml ? 'പലചരക്കിലേക്ക്' : 'Add to Grocery';
  if (kind === 'calendar') return ml ? 'കലണ്ടറിൽ' : 'Save to Calendar';
  if (kind === 'delete') return ml ? 'ഒഴിവാക്കുക' : 'Delete Task';
  if (kind === 'expense') return ml ? 'ചിലവിൽ ചേർക്കുക' : 'Log Expense';
  if (kind === 'bill') return ml ? 'ബിൽ സേവ്' : 'Save Bill';
  if (kind === 'medicine') return ml ? 'മരുന്നിൽ' : 'Medicine';
  return ml ? 'ജോലി ചേർക്കുക' : 'Add Task';
}

export function formatRelativeDate(ymd, lang = 'en') {
  if (!ymd) return '';
  const today = todayStr();
  const tomorrow = addDaysStr(today, 1);
  const ml = lang === 'ml';
  if (ymd === today) return ml ? 'ഇന്ന്' : 'Today';
  if (ymd === tomorrow) return ml ? 'നാളെ' : 'Tomorrow';
  return shortDate(ymd, lang);
}

export function formatSlotLabel(slot, lang = 'en') {
  const ml = lang === 'ml';
  if (slot === 'morning') return ml ? 'രാവിലെ' : 'Breakfast';
  if (slot === 'noon') return ml ? 'ഉച്ചയ്ക്ക്' : 'Lunch';
  if (slot === 'night') return ml ? 'രാത്രി' : 'Dinner';
  return '';
}

/** Formats concise, human-scannable subtitle metadata for any AI action. */
export function formatActionSubtitle(act, lang = 'en') {
  const kind = actionKind(act.type);
  const ml = lang === 'ml';

  if (kind === 'meal') {
    const day = formatRelativeDate(act.date, lang) || (ml ? 'നാളെ' : 'Tomorrow');
    const slot = formatSlotLabel(act.slot, lang);
    const cook = act.cookName ? (ml ? `പാചകം: ${act.cookName}` : `Cook: ${act.cookName}`) : '';
    return [day, slot, cook].filter(Boolean).join(' · ');
  }
  if (kind === 'recipe') {
    const ing = act.ingredients?.length ? `${act.ingredients.length} ${ml ? 'ചേരുവകൾ' : 'ingredients'}` : '';
    const st = act.steps?.length ? `${act.steps.length} ${ml ? 'ഘട്ടങ്ങൾ' : 'steps'}` : '';
    return [ing, st].filter(Boolean).join(' · ');
  }
  if (kind === 'grocery') {
    return act.quantity || '';
  }
  if (kind === 'calendar') {
    const day = formatRelativeDate(act.dueDate || act.date, lang);
    return [day, act.assigneeName || ''].filter(Boolean).join(' · ');
  }
  if (kind === 'expense') {
    return [act.amount ? `₹${act.amount}` : '', act.category || ''].filter(Boolean).join(' · ');
  }
  if (kind === 'task' || kind === 'bill') {
    const day = formatRelativeDate(act.dueDate || act.date, lang);
    return [day, act.assigneeName || ''].filter(Boolean).join(' · ');
  }
  return '';
}

/** Builds a clear, natural button label describing what tapping Save actually does. */
export function smartApplyLabel(selected, lang = 'en') {
  const ml = lang === 'ml';
  const count = selected?.length || 0;
  if (count === 0) return ml ? 'സേവ് ചെയ്യാനുള്ളവ തിരഞ്ഞെടുക്കുക' : 'Select items to save';

  const counts = { meal: 0, recipe: 0, grocery: 0, calendar: 0, task: 0, expense: 0, bill: 0, delete: 0 };
  for (const a of selected) {
    const k = actionKind(a.type);
    counts[k] = (counts[k] || 0) + 1;
  }

  const activeKinds = Object.entries(counts).filter(([, n]) => n > 0);
  if (activeKinds.length === 1) {
    const [k, n] = activeKinds[0];
    if (k === 'delete') return ml ? (n > 1 ? `${n} ജോലികൾ ഒഴിവാക്കുക` : 'ജോലി ഒഴിവാക്കുക') : (n > 1 ? `Delete ${n} Tasks` : 'Delete Task');
    if (k === 'recipe') return ml ? 'പാചകക്കുറിപ്പിലേക്ക് സേവ് ചെയ്യുക' : 'Save to Recipes';
    if (k === 'meal') return ml ? 'ഭക്ഷണ പ്ലാനിൽ സേവ് ചെയ്യുക' : 'Save to Meal Plan';
    if (k === 'grocery') return ml ? `${n} സാധനങ്ങൾ ലിസ്റ്റിൽ ചേർക്കുക` : `Add ${n} to Grocery`;
    if (k === 'calendar') return ml ? 'കലണ്ടറിൽ സേവ് ചെയ്യുക' : 'Save to Calendar';
    if (k === 'expense') return ml ? 'ചിലവ് സേവ് ചെയ്യുക' : 'Save Expense';
    if (k === 'bill') return ml ? 'ബിൽ സേവ് ചെയ്യുക' : 'Save Bill';
    return ml ? (n > 1 ? `${n} ജോലികൾ ചേർക്കുക` : 'ജോലി ചേർക്കുക') : (n > 1 ? `Add ${n} Tasks` : 'Add Task');
  }

  const parts = [];
  if (counts.meal) parts.push(ml ? 'പ്ലാൻ' : 'Meal');
  if (counts.recipe) parts.push(ml ? 'റെസിപ്പി' : 'Recipe');
  if (counts.grocery) parts.push(ml ? `${counts.grocery} സാധനങ്ങൾ` : (counts.meal || counts.recipe ? 'List' : `${counts.grocery} Groceries`));
  if (counts.calendar) parts.push(ml ? 'കലണ്ടർ' : 'Calendar');
  if (counts.task) parts.push(ml ? 'ജോലി' : 'Tasks');
  if (counts.expense) parts.push(ml ? 'ചിലവ്' : 'Expense');
  if (counts.bill) parts.push(ml ? 'ബിൽ' : 'Bills');

  if (parts.length === 2) {
    return ml ? `${parts[0]} & ${parts[1]} സേവ് ചെയ്യുക` : `Save ${parts[0]} & ${parts[1]}`;
  }
  if (parts.length === 3 && counts.meal && counts.recipe && counts.grocery) {
    return ml ? `പ്ലാനും റെസിപ്പിയും ലിസ്റ്റും സേവ് (${count})` : `Save Meal, Recipe & List (${count})`;
  }
  return ml ? `തിരഞ്ഞെടുത്തവ സേവ് ചെയ്യുക (${count})` : `Save All Selected (${count})`;
}

/** Returns clean destination links for whichever item kinds were saved. */
export function destinationLinks(selected, lang = 'en') {
  const ml = lang === 'ml';
  const kinds = new Set((selected || []).map((a) => actionKind(a.type)));
  const links = [];
  if (kinds.has('recipe')) links.push({ href: '/planner?tab=recipes', label: ml ? 'റെസിപ്പി കാണുക' : 'View Recipes' });
  if (kinds.has('meal')) links.push({ href: '/planner?tab=meals', label: ml ? 'മീൽ പ്ലാൻ' : 'View Meals' });
  if (kinds.has('grocery')) links.push({ href: '/planner?tab=grocery', label: ml ? 'പലചരക്ക് ലിസ്റ്റ്' : 'View Grocery' });
  if (kinds.has('calendar')) links.push({ href: '/planner?tab=calendar', label: ml ? 'കലണ്ടർ' : 'View Calendar' });
  if (kinds.has('task')) links.push({ href: '/planner?tab=tasks', label: ml ? 'ജോലികൾ' : 'View Tasks' });
  if (kinds.has('expense')) links.push({ href: '/money', label: ml ? 'ചിലവുകൾ' : 'View Money' });
  return links.slice(0, 3);
}
