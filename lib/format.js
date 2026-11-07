export const rupees = (paise, { sign = false } = {}) => {
  const v = (paise || 0) / 100;
  const s = `₹${Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
  return v < 0 ? `-${s}` : sign && v > 0 ? `+${s}` : s;
};
/** "1840" or "1,840.50" typed by a person -> integer paise (or null if invalid). */
export const toPaise = (text) => {
  const n = Number(String(text).replace(/[,\s₹]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};
export const todayStr = (tz = 'Asia/Kolkata') => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
export const addDaysStr = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const shortDate = (s, lang = 'en') => {
  if (!s) return '';
  const loc = lang === 'ml' ? 'ml-IN' : lang === 'ta' ? 'ta-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
  return new Date(`${s}T00:00:00Z`).toLocaleDateString(loc, { day: 'numeric', month: 'short', timeZone: 'UTC' });
};
export const longDate = (s, lang = 'en') => {
  if (!s) return '';
  const loc = lang === 'ml' ? 'ml-IN' : lang === 'ta' ? 'ta-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
  return new Date(`${s}T00:00:00Z`).toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
export const daysLabel = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n < 0 ? `${-n} days ago` : `in ${n} days`);
export const timeAgo = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
export const hhmm = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
export const CATEGORY_LABEL = {
  electricity: 'Electricity', water: 'Water', internet: 'Internet', phone: 'Phone', gas: 'Gas', rent: 'Rent', tax: 'Tax', insurance: 'Insurance',
  emi: 'EMI', subscription: 'Subscription', school: 'School', other: 'Other', grocery: 'Grocery', food: 'Food', bills: 'Bills', medical: 'Medical',
  transport: 'Transport', shopping: 'Shopping', education: 'Education', entertainment: 'Entertainment', household: 'Household',
};
