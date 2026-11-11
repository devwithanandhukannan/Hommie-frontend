// Browser API client: access token lives in memory only; the refresh token is an httpOnly cookie.
// Every state-changing call carries the CSRF token (double-submit cookie) and the active family id.
let access = null;
let familyId = null;
let refreshing = null;
let onSessionLost = () => {};

const statusListeners = new Set();
let wakingOps = 0;
let bootingOps = 0;
let lastStatus = { isWakingUp: false, isBooting: false };
let wakingPromise = null;

function emitServerStatus() {
  const isBooting = bootingOps > 0;
  const isWakingUp = isBooting || wakingOps > 0;
  if (isBooting === lastStatus.isBooting && isWakingUp === lastStatus.isWakingUp) return;
  lastStatus = { isWakingUp, isBooting };
  statusListeners.forEach((fn) => {
    try { fn(lastStatus); } catch {}
  });
}

function beginBootTrack() {
  let active = false;
  return {
    start() {
      if (active) return;
      active = true;
      bootingOps++;
      emitServerStatus();
    },
    stop() {
      if (!active) return;
      active = false;
      bootingOps = Math.max(0, bootingOps - 1);
      emitServerStatus();
    },
  };
}

function beginWakeTrack() {
  let counted = false;
  const trigger = () => {
    if (counted) return;
    counted = true;
    wakingOps++;
    emitServerStatus();
  };
  const slowTimer = typeof window !== 'undefined' ? setTimeout(trigger, 2500) : null;
  return {
    markWaking: trigger,
    done() {
      if (slowTimer) clearTimeout(slowTimer);
      if (counted) {
        wakingOps = Math.max(0, wakingOps - 1);
        emitServerStatus();
      }
    },
  };
}

export function onServerStatusChange(fn) {
  statusListeners.add(fn);
  try { fn(lastStatus); } catch {}
  return () => statusListeners.delete(fn);
}

/**
 * Checks whether the API server is awake via lightweight `GET /api/health`.
 * If the server is cold-starting (e.g. Render free tier), signals `isBooting`
 * after 600ms (or immediately on 502/503/504) and waits until it responds 200 OK.
 */
export function ensureServerAwake({ timeoutMs = 75_000 } = {}) {
  if (typeof window === 'undefined') return Promise.resolve('ready');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve('offline');
  if (wakingPromise) return wakingPromise;

  wakingPromise = (async () => {
    const tracker = beginBootTrack();
    const showTimer = setTimeout(() => tracker.start(), 600);
    const deadline = Date.now() + timeoutMs;

    try {
      while (Date.now() < deadline) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
        const remaining = deadline - Date.now();
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const abortTimer = ctrl ? setTimeout(() => ctrl.abort(), Math.min(12_000, Math.max(1500, remaining))) : null;
        try {
          const res = await fetch('/api/health', {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: ctrl?.signal,
          });
          if (res.ok) return 'ready';
          tracker.start();
        } catch {
          if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
          tracker.start();
        } finally {
          if (abortTimer) clearTimeout(abortTimer);
        }
        const sleepMs = Math.min(2500, Math.max(0, deadline - Date.now()));
        if (sleepMs > 0) await new Promise((r) => setTimeout(r, sleepMs));
      }
      return 'offline';
    } finally {
      clearTimeout(showTimer);
      tracker.stop();
      wakingPromise = null;
    }
  })();

  return wakingPromise;
}

export const getAuthHeaders = () => ({
  ...(access ? { Authorization: `Bearer ${access}` } : {}),
  ...(familyId ? { 'X-Family-Id': familyId } : {}),
});

export const setAccessToken = (t) => { access = t; };
export const setActiveFamily = (id) => { familyId = id; };
export const setSessionLostHandler = (fn) => { onSessionLost = fn; };

export class ApiError extends Error {
  constructor(status, message, issues) { super(message); this.status = status; this.issues = issues || []; }
}

function cookie(name) {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}

export async function csrfToken(quiet = false, force = false) {
  let t = force ? '' : cookie('fh_csrf');
  if (t) return t;

  let attempt = 0;
  const maxAttempts = 2;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const r = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
      if ([502, 503, 504].includes(r.status)) {
        if (attempt < maxAttempts) {
          const ready = await ensureServerAwake();
          if (ready === 'ready') continue;
        }
        throw new ApiError(r.status, 'Server temporarily unavailable. Please try again in a moment.');
      }
      if (!r.ok) {
        throw new ApiError(r.status, 'Unable to initialize secure session. Please try again.');
      }
      const data = await r.json().catch(() => ({}));
      t = data?.csrfToken || cookie('fh_csrf');
      if (t) return t;
      throw new ApiError(500, 'Security token was missing from response');
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && !(err instanceof ApiError && err.status < 500)) {
        const ready = await ensureServerAwake();
        if (ready === 'ready') continue;
      }
      break;
    }
  }

  if (quiet) return null;
  if (lastError instanceof ApiError) throw lastError;
  throw new ApiError(503, 'Unable to reach the server right now. Please try again.');
}

/** Pre-fetches the CSRF cookie in the background without throwing errors. */
export async function prefetchCsrf() {
  try {
    return await csrfToken(true);
  } catch {
    return null;
  }
}

const SAFE_TO_RETRY = new Set(['GET', 'HEAD']);

async function send(method, path, { body, form, auth = true, family = true, forceCsrf = false } = {}) {
  const headers = {};
  if (method !== 'GET') {
    const token = await csrfToken(false, forceCsrf);
    if (token) headers['X-CSRF-Token'] = token;
  }
  if (auth && access) headers.Authorization = `Bearer ${access}`;
  if (family && familyId) headers['X-Family-Id'] = familyId;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  // Only reads are retried. A write that failed in flight might already have been applied.
  const canRetry = SAFE_TO_RETRY.has(method);
  const maxAttempts = canRetry ? 3 : 1;
  let attempt = 0;
  let waitedBoot = false;
  const tracker = beginWakeTrack();
  try {
    while (attempt < maxAttempts) {
      attempt++;
      try {
        const res = await fetch(`/api${path}`, {
          method,
          headers,
          body: payload,
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if ([502, 503, 504].includes(res.status) && canRetry) {
          tracker.markWaking();
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 900 * attempt));
            continue;
          }
          if (!waitedBoot) {
            waitedBoot = true;
            const ready = await ensureServerAwake();
            if (ready === 'ready') { attempt--; continue; }
          }
        }
        return res;
      } catch {
        if (canRetry) {
          tracker.markWaking();
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 900 * attempt));
            continue;
          }
          if (!waitedBoot) {
            waitedBoot = true;
            const ready = await ensureServerAwake();
            if (ready === 'ready') { attempt--; continue; }
          }
        }
        throw new ApiError(0, 'You seem to be offline. Please check your connection and try again.');
      }
    }
  } finally {
    tracker.done();
  }
}

/** Exchanges the refresh cookie for a new access token. Pre-wakes cold-starting servers cleanly first. */
export function refreshSession() {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const ready = await ensureServerAwake();
        if (ready === 'offline') return 'offline';

        let res = await send('POST', '/auth/refresh', { body: {}, auth: false, family: false });
        if (res.status === 403) {
          // Stale or missing CSRF cookie should not invalidate a live refresh session.
          res = await send('POST', '/auth/refresh', { body: {}, auth: false, family: false, forceCsrf: true });
        }
        if ([502, 503, 504].includes(res.status)) {
          const again = await ensureServerAwake();
          if (again !== 'ready') return 'offline';
          res = await send('POST', '/auth/refresh', { body: {}, auth: false, family: false });
        }
        if (res.status === 401 || res.status === 403) { access = null; return null; }
        if (!res.ok) return 'offline';
        const data = await res.json();
        access = data.accessToken;
        return data.user;
      } catch { return 'offline'; } finally { setTimeout(() => { refreshing = null; }, 0); }
    })();
  }
  return refreshing;
}

async function parse(res) {
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json().catch(() => ({})) : null;
  if (!res.ok) {
    let msg = data?.error;
    if (!msg || typeof msg !== 'string') {
      if ([502, 503, 504].includes(res.status)) {
        msg = 'Server temporarily unavailable. Please try again in a moment.';
      } else if (res.status === 404) {
        msg = 'Not found';
      } else if (res.status === 403) {
        msg = 'Access denied';
      } else {
        msg = 'Something went wrong. Please try again.';
      }
    }
    throw new ApiError(res.status, msg, data?.issues);
  }
  return data;
}

export async function api(method, path, opts = {}) {
  let res = await send(method, path, opts);
  if (res.status === 401 && opts.auth !== false && !path.startsWith('/auth/')) {
    const renewed = await refreshSession();
    if (renewed === 'offline') throw new ApiError(0, 'You seem to be offline. Please check your connection and try again.');
    if (renewed) res = await send(method, path, opts);
    else { onSessionLost(); throw new ApiError(401, 'Please sign in again'); }
  }
  return parse(res);
}

export const get = (p, o) => api('GET', p, o);
export const post = (p, body, o) => api('POST', p, { ...o, body });
export const put = (p, body, o) => api('PUT', p, { ...o, body });
export const patch = (p, body, o) => api('PATCH', p, { ...o, body });
export const del = (p, body, o) => api('DELETE', p, { ...o, body });
export const upload = (p, form, o) => api('POST', p, { ...o, form });

/** Fetches a protected file (document or image) as a Blob, with the auth header. */
export async function getBlob(path) {
  let res = await send('GET', path);
  if (res.status === 401) { const r = await refreshSession(); if (r && r !== 'offline') res = await send('GET', path); }
  if (!res.ok) throw new ApiError(res.status, res.status === 404 ? 'File not found' : 'Could not load the file');
  return res.blob();
}

export function clearPrivateCaches() {
  try { navigator.serviceWorker?.controller?.postMessage('clear-private-cache'); } catch { /* ignore */ }
}
