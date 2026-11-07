// Browser API client: access token lives in memory only; the refresh token is an httpOnly cookie.
// Every state-changing call carries the CSRF token (double-submit cookie) and the active family id.
let access = null;
let familyId = null;
let refreshing = null;
let onSessionLost = () => {};

let pendingRequests = 0;
let wakeTimer = null;
let isWaking = false;
const statusListeners = new Set();

export function onServerStatusChange(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

function notifyStatus(waking) {
  if (isWaking === waking) return;
  isWaking = waking;
  for (const fn of statusListeners) {
    try { fn(waking); } catch {}
  }
}

function beginRequest() {
  pendingRequests++;
  if (pendingRequests === 1 && !wakeTimer) {
    wakeTimer = setTimeout(() => {
      if (pendingRequests > 0) notifyStatus(true);
    }, 2000);
  }
}

function endRequest() {
  pendingRequests = Math.max(0, pendingRequests - 1);
  if (pendingRequests === 0) {
    if (wakeTimer) {
      clearTimeout(wakeTimer);
      wakeTimer = null;
    }
    notifyStatus(false);
  }
}

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

export async function csrfToken(quiet = false) {
  let t = cookie('fh_csrf');
  if (t) return t;

  beginRequest();
  let attempt = 0;
  const maxAttempts = 4;
  let lastError = null;

  try {
    while (attempt < maxAttempts) {
      attempt++;
      try {
        const r = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
        if ([502, 503, 504].includes(r.status)) {
          notifyStatus(true);
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 2500));
            continue;
          }
          throw new ApiError(r.status, 'The server is currently waking up. Please try again in a few moments.');
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
        if (attempt < maxAttempts) {
          notifyStatus(true);
          await new Promise((resolve) => setTimeout(resolve, 2500));
          continue;
        }
        break;
      }
    }
  } finally {
    endRequest();
  }

  if (quiet) return null;
  if (lastError instanceof ApiError) throw lastError;
  throw new ApiError(503, 'The server is taking longer than expected to wake up. Please try again in a few moments.');
}

/** Pre-warms the backend and pre-fetches the CSRF cookie in the background without throwing errors */
export async function prefetchCsrf() {
  try {
    return await csrfToken(true);
  } catch {
    return null;
  }
}

async function send(method, path, { body, form, auth = true, family = true } = {}) {
  beginRequest();
  try {
    const headers = {};
    if (method !== 'GET') {
      const token = await csrfToken();
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

    let attempt = 0;
    const maxAttempts = 4;
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
        // Render free-tier returns 502/503/504 while warming up or booting
        if ([502, 503, 504].includes(res.status) && attempt < maxAttempts) {
          notifyStatus(true);
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }
        return res;
      } catch (err) {
        if (attempt < maxAttempts) {
          notifyStatus(true);
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }
        throw err;
      }
    }
  } finally {
    endRequest();
  }
}

/** Exchanges the refresh cookie for a new access token. One call at a time, shared by concurrent callers. */
export function refreshSession() {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await send('POST', '/auth/refresh', { body: {}, auth: false, family: false });
        if (!res.ok) { access = null; return null; }
        const data = await res.json();
        access = data.accessToken;
        return data.user;
      } catch { return null; } finally { setTimeout(() => { refreshing = null; }, 0); }
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
        msg = 'The server is waking up or temporarily unavailable. Please try again in a few moments.';
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
    if (await refreshSession()) res = await send(method, path, opts);
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
  if (res.status === 401 && (await refreshSession())) res = await send('GET', path);
  if (!res.ok) throw new ApiError(res.status, res.status === 404 ? 'File not found' : 'Could not load the file');
  return res.blob();
}

export function clearPrivateCaches() {
  try { navigator.serviceWorker?.controller?.postMessage('clear-private-cache'); } catch { /* ignore */ }
}
