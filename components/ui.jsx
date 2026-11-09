'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { initials } from '@/lib/format';
import { translate, translateToast } from '@/lib/i18n';

const getAppLang = () => (typeof window !== 'undefined' && window.localStorage?.getItem('fh_lang')) || 'en';

export function formatErrorMessage(error) {
  if (!error) return null;
  const raw = typeof error === 'string' ? error : error?.message || String(error || '');
  if (!raw || raw === '[object Object]') {
    return 'An unexpected error occurred. Please try again.';
  }

  // Detect raw HTML responses (e.g. <!DOCTYPE html>, <html, <body>, <title>)
  const isHtml = /<!doctype|<html|<body|<div|<title|<head|<style|<script/i.test(raw);

  // Detect gateway/proxy cold-start status codes or messages
  const isColdStartOrGateway =
    /\b(502|503|504)\b/.test(raw) ||
    /bad gateway/i.test(raw) ||
    /gateway timeout/i.test(raw) ||
    /service unavailable/i.test(raw) ||
    /failed to fetch csrf token/i.test(raw);

  if (isHtml || isColdStartOrGateway) {
    return 'The server is waking up or temporarily unavailable. Please try again in a few moments.';
  }

  // Detect network/connectivity failures
  if (/failed to fetch|networkerror|load failed|err_connection_refused/i.test(raw)) {
    return 'Unable to connect to the server. Please check your internet connection or try again in a moment.';
  }

  // Strip any stray HTML tags and clean whitespace
  const clean = raw.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();

  // Truncate overly long technical dumps / stack traces
  if (clean.length > 200) {
    return clean.slice(0, 197) + '…';
  }

  return clean;
}

export const Spinner = () => <div className="spinner" role="status" aria-label="Loading" />;
export const ErrorNote = ({ error }) => {
  const msg = formatErrorMessage(error);
  if (!msg) return null;
  return (
    <div className="err" role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span style={{ wordBreak: 'break-word', lineHeight: 1.45 }}>{msg}</span>
    </div>
  );
};
export const Empty = ({ children }) => <div className="empty">{children}</div>;
export const Badge = ({ tone = '', children }) => <span className={`badge ${tone}`}>{children}</span>;

export function Btn({ tone = '', size = '', children, ...p }) {
  return <button type="button" {...p} className={`btn ${tone} ${size} ${p.className || ''}`}>{children}</button>;
}

export function Avatar({ member, size = 32 }) {
  if (!member) return null;
  return <span className="avatar" style={{ background: member.color, width: size, height: size }} title={member.displayName} aria-label={member.displayName}>{initials(member.displayName)}</span>;
}

export function Field({ label, children, hint }) {
  const id = useRef(`f${Math.random().toString(36).slice(2, 9)}`).current;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {typeof children === 'function' ? children(id) : children}
      {hint ? <span className="tiny muted">{hint}</span> : null}
    </div>
  );
}
export const Input = (p) => <input {...p} className={`input ${p.className || ''}`} />;
export const Select = ({ children, ...p }) => <select {...p} className={`select ${p.className || ''}`}>{children}</select>;

export function Switch({ checked, onChange, disabled = false, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`apple-toggle ${checked ? 'on' : ''}`}
      onClick={() => !disabled && onChange && onChange(!checked)}
    >
      <span className="apple-toggle-thumb" />
    </button>
  );
}

export function Tabs({ value, onChange, items }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={value === key} onClick={() => onChange(key)}>{label}</button>)}
    </div>
  );
}

export function PageHeader({ title, sub, children }) {
  return (
    <div className="row between wrap" style={{ marginBottom: 12 }}>
      <div><h1>{title}</h1>{sub ? <p className="muted small" style={{ margin: '4px 0 0' }}>{sub}</p> : null}</div>
      <div className="row wrap">{children}</div>
    </div>
  );
}

export function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  const lang = getAppLang();
  useEffect(() => {
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('input,select,textarea,button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="grab" />
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18 }}>{title}</h2>
          <button type="button" className="icon-btn" aria-label={translate(lang, 'btn.close')} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timerRef = useRef(null);

  const push = useCallback((text, bad = false) => {
    const clean = bad ? (formatErrorMessage(text) || text) : text;
    const lang = getAppLang();
    const localized = translateToast(clean, lang);
    const id = Date.now() + Math.random();
    setItems([{ id, text: localized, bad }]);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setItems((l) => l.filter((x) => x.id !== id));
    }, 2800);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`toast ${i.bad ? 'bad' : ''}`}>
            <span className={`toast-dot ${i.bad ? 'bad' : 'ok'}`} />
            <span>{i.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

const ConfirmCtx = createContext(async () => true);
export const useConfirm = () => useContext(ConfirmCtx);

export const useAlert = () => {
  const confirm = useConfirm();
  return useCallback((message, title = 'Notice') => {
    return confirm({ title, message, isAlert: true, confirmText: 'OK', tone: 'brand' });
  }, [confirm]);
};

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const cancelBtnRef = useRef(null);
  const confirmBtnRef = useRef(null);

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      let config = {};
      if (typeof opts === 'string') {
        const text = opts.trim();
        const isDelete = /delete|remove|stop/i.test(text);
        const isLeave = /leave/i.test(text);
        let actionWord = 'Confirm';
        if (/delete/i.test(text)) actionWord = 'Delete';
        else if (/remove/i.test(text)) actionWord = 'Remove';
        else if (/stop/i.test(text)) actionWord = 'Stop';
        else if (/leave/i.test(text)) actionWord = 'Leave';

        config = {
          title: text.endsWith('?') ? text : `${text}?`,
          message: isDelete || isLeave ? 'Are you sure you want to proceed? This action cannot be undone.' : '',
          confirmText: actionWord,
          cancelText: 'Cancel',
          tone: isDelete || isLeave ? 'danger' : 'brand',
          isAlert: false,
        };
      } else {
        config = {
          title: opts.title || 'Are you sure?',
          message: opts.message || '',
          confirmText: opts.confirmText || (opts.isAlert ? 'OK' : 'Confirm'),
          cancelText: opts.cancelText || 'Cancel',
          tone: opts.tone || 'danger',
          isAlert: !!opts.isAlert,
        };
      }

      setDialog({
        ...config,
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback((result) => {
    if (dialog) {
      dialog.resolve(result);
      setDialog(null);
    }
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
      }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      if (dialog.isAlert) confirmBtnRef.current?.focus();
      else cancelBtnRef.current?.focus();
    }, 40);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [dialog, handleClose]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {dialog ? (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose(false);
          }}
        >
          <div className="confirm-card">
            <div className={`confirm-icon-wrap ${dialog.tone}`}>
              <Icon name={dialog.tone === 'danger' ? 'trash' : 'alert'} size={24} />
            </div>
            <div>
              <h2 id="confirm-modal-title" style={{ fontSize: 18, marginBottom: 6 }}>
                {dialog.title}
              </h2>
              {dialog.message ? (
                <p className="muted small" style={{ margin: 0, lineHeight: 1.5 }}>
                  {dialog.message}
                </p>
              ) : null}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              {!dialog.isAlert ? (
                <button
                  type="button"
                  ref={cancelBtnRef}
                  className="btn ghost sm grow"
                  onClick={() => handleClose(false)}
                >
                  {dialog.cancelText === 'Cancel' ? translate(getAppLang(), 'btn.cancel') : dialog.cancelText}
                </button>
              ) : null}
              <button
                type="button"
                ref={confirmBtnRef}
                className={`btn sm grow ${dialog.tone === 'danger' ? 'danger' : ''}`}
                onClick={() => handleClose(true)}
              >
                {dialog.confirmText === 'Confirm'
                  ? translate(getAppLang(), 'btn.confirm')
                  : dialog.confirmText === 'Delete'
                  ? translate(getAppLang(), 'btn.delete')
                  : dialog.confirmText === 'Remove'
                  ? translate(getAppLang(), 'btn.remove')
                  : dialog.confirmText === 'OK'
                  ? translate(getAppLang(), 'btn.ok')
                  : dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmCtx.Provider>
  );
}

/** Runs an async action with a pending flag and a toast on failure. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn, okMsg) => {
    setBusy(true);
    try { const r = await fn(); if (okMsg) toast(okMsg); return r ?? true; } catch (e) { toast(formatErrorMessage(e) || 'Something went wrong', true); return false; } finally { setBusy(false); }
  }, [toast]);
  return [run, busy];
}

export function MemberSelect({ members, value, onChange, allowNone, noneLabel = 'Anyone', ...p }) {
  return (
    <Select value={value || ''} onChange={(e) => onChange(e.target.value || null)} {...p}>
      {allowNone ? <option value="">{noneLabel}</option> : null}
      {members.map((m) => <option key={m.membershipId} value={m.membershipId}>{m.displayName}</option>)}
    </Select>
  );
}

export function MemberChecks({ members, value, onChange }) {
  const set = new Set(value);
  return (
    <div className="stack-sm">
      {members.map((m) => (
        <label key={m.membershipId} className="check">
          <input type="checkbox" checked={set.has(m.membershipId)} onChange={(e) => { const s = new Set(set); if (e.target.checked) s.add(m.membershipId); else s.delete(m.membershipId); onChange([...s]); }} />
          <Avatar member={m} size={26} /> {m.displayName}
        </label>
      ))}
    </div>
  );
}

export const COMMON_UNITS = ['pcs', 'kg', 'g', 'L', 'ml', 'pack', 'doz', 'box', 'bottle', 'bunch'];

export function UnitButtons({ selected, onSelect }) {
  return (
    <div className="unit-buttons-bar" role="radiogroup" aria-label="Units">
      {COMMON_UNITS.map((u) => {
        const isSel = selected === u;
        return (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={isSel}
            className={`unit-btn ${isSel ? 'active' : ''}`}
            onClick={() => onSelect(isSel ? '' : u)}
          >
            {u}
          </button>
        );
      })}
    </div>
  );
}

export function parseQty(qtyStr) {
  if (!qtyStr) return { amount: '', unit: 'pcs' };
  const str = String(qtyStr).trim();
  const match = str.match(/^([\d.,/]+)\s*(.*)$/);
  if (!match) return { amount: str, unit: '' };
  const amount = match[1];
  const unitRaw = match[2].trim().toLowerCase();
  const found = COMMON_UNITS.find((u) => u.toLowerCase() === unitRaw) || unitRaw;
  return { amount, unit: found };
}

export function formatQty(amount, unit) {
  const cleanAmount = (amount || '').trim();
  const cleanUnit = (unit || '').trim();
  if (cleanAmount && cleanUnit) return `${cleanAmount} ${cleanUnit}`;
  return cleanAmount || cleanUnit || '';
}

export const Icon = ({ name, size = 20 }) => {
  const paths = {
    home: 'M3 9.5L12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20V9.5z M9 21v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6',
    tasks: 'M9 11l2.5 2.5L16 8 M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    bills: 'M4 3h16a1 1 0 0 1 1 1v16l-3-1.5L15 20l-3-1.5L9 20l-3-1.5L3 20V4a1 1 0 0 1 1-1zm4 5h8M8 12h8M8 16h5',
    money: 'M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6zm0 4h20M6 15h3',
    grocery: 'M4 4h2l2.5 11h10l2-8H7 M9 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    meals: 'M18 3v18M18 7a3 3 0 0 0-3-3v14h3M6 3v6a2 2 0 0 0 2 2v10M6 3a2 2 0 0 1 2 2v4a2 2 0 0 1-2-2',
    recipes: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z',
    docs: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
    med: 'M10.5 13.5l-5.7 5.7a4 4 0 0 1-5.6-5.6l5.7-5.7 M8.5 7.5l5.7-5.7a4 4 0 0 1 5.6 5.6l-5.7 5.7 M7.5 16.5l9-9',
    days: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6zm0 4h18M8 2v4M16 2v4',
    calendar: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6zm0 4h18M8 2v4M16 2v4',
    family: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    chat: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8.5z',
    more: 'M4 7h16 M4 12h16 M4 17h16',
    menu: 'M4 7h16 M4 12h16 M4 17h16',
    drag: 'M9 6h.01 M9 12h.01 M9 18h.01 M15 6h.01 M15 12h.01 M15 18h.01',
    kanban: 'M4 4h4v16H4z M10 4h4v16h-4z M16 4h4v16h-4z',
    list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
    cart: 'M6 6h15l-1.5 9h-11L6 3H3 M9 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
    swap: 'M16 3l4 4-4 4 M20 7H4 M8 21l-4-4 4-4 M4 17h16',
    send: 'M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z',
    mic: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8',
    reply: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 0 1 0 12h-3',
    play: 'M5 3l14 9-14 9V3z',
    pause: 'M6 4h4v16H6z M14 4h4v16h-4z',
    stop: 'M6 6h12v12H6z',
    photo: 'M21 16l-5.5-5.5a1.5 1.5 0 0 0-2.1 0L4 20 M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm6 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
    lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zm-12 0V7a5 5 0 0 1 10 0v4',
    plus: 'M12 5v14 M5 12h14',
    back: 'M15 18l-6-6 6-6',
    trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M10 11v6 M14 11v6',
    alert: 'M12 8v4 M12 16h.01 M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    check: 'M20 6L9 17l-5-5',
    edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
    sun: 'M12 3v2 M12 19v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
    moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
    sparkles: 'M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z',
    bulb: 'M9 18h6 M10 22h4 M12 2a7 7 0 0 0-7 7c0 2.6 1.4 4.8 3.5 6h7c2.1-1.2 3.5-3.4 3.5-6a7 7 0 0 0-7-7z',
    store: 'M3 9l1-5h16l1 5 M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9 M3 9h18 M9 21V13h6v8',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    broom: 'M14 4l6 6 M18 8l-8.5 8.5a2.12 2.12 0 0 1-3 0l-.5-.5a2.12 2.12 0 0 1 0-3L14.5 4.5 M3 21l6-2 M3 21l2-6',
    close: 'M18 6L6 18 M6 6l12 12',
    tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] || ''} />
    </svg>
  );
};
