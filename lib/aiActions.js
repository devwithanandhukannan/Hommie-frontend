/**
 * Shared client-side helpers for Hommi AI action cards and /ai/apply payload sanitization.
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

export function actionIconName(type) {
  if (!type) return 'tasks';
  if (type.includes('grocery')) return 'cart';
  if (type.includes('recipe')) return 'recipes';
  if (type.includes('meal')) return 'meals';
  if (type.includes('calendar')) return 'calendar';
  if (type.includes('delete')) return 'trash';
  if (type.includes('expense')) return 'money';
  if (type.includes('bill')) return 'bills';
  if (type.includes('medicine')) return 'med';
  return 'tasks';
}

