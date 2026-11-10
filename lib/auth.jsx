'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, get, post, getAuthHeaders, setAccessToken, setActiveFamily, setSessionLostHandler, refreshSession, clearPrivateCaches } from '@/lib/api';
import { translate, translateNotificationText } from '@/lib/i18n';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export function AuthProvider({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState('loading'); // loading | anon | authed | offline
  const [user, setUser] = useState(null);
  const [families, setFamilies] = useState([]);
  const [family, setFamily] = useState(null);
  const familyIdRef = useRef(null);

  const loadFamily = useCallback(async (id) => {
    setActiveFamily(id);
    familyIdRef.current = id;
    const f = await get('/families/current');
    setFamily(f);
    store.set('fh_family', id);
    return f;
  }, []);

  const loadOverview = useCallback(async () => {
    const list = await get('/overview', { family: false });
    setFamilies(list);
    return list;
  }, []);

  const afterLogin = useCallback(async (u) => {
    setUser(u);
    const list = await loadOverview();
    const saved = store.get('fh_family');
    const pick = list.find((f) => f.id === saved) || list[0];
    if (pick) await loadFamily(pick.id); else { setFamily(null); setActiveFamily(null); }
    setStatus('authed');
    return list;
  }, [loadFamily, loadOverview]);

  // 'offline' means we could not reach the server: keep the person's session and let them retry, never log them out.
  const boot = useCallback(async () => {
    setStatus('loading');
    const u = await refreshSession();
    if (u === 'offline') { setStatus('offline'); return; }
    if (!u) { setStatus('anon'); return; }
    try { await afterLogin(u); } catch (e) { setStatus(e?.status === 401 ? 'anon' : 'offline'); }
  }, [afterLogin]);

  useEffect(() => {
    setSessionLostHandler(() => { setUser(null); setFamily(null); setFamilies([]); setStatus('anon'); });
    boot();
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      } else {
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
      }
    }
  }, [boot]);

  const signIn = useCallback(async (path, body) => {
    const data = await post(path, body, { auth: false, family: false });
    setAccessToken(data.accessToken);
    return afterLogin(data.user);
  }, [afterLogin]);

  const signOut = useCallback(async () => {
    try { await post('/auth/logout', {}, { auth: false, family: false }); } catch { /* ignore */ }
    setAccessToken(null); setActiveFamily(null);
    store.del('fh_family');
    clearPrivateCaches();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('hommi:clear-blobs'));
    setUser(null); setFamily(null); setFamilies([]); setStatus('anon');
    router.replace('/login');
  }, [router]);

  const switchFamily = useCallback(async (id) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('hommi:clear-blobs'));
    await loadFamily(id);
    await loadOverview();
  }, [loadFamily, loadOverview]);
  const reloadFamily = useCallback(async () => { if (familyIdRef.current) { await loadFamily(familyIdRef.current); await loadOverview(); } }, [loadFamily, loadOverview]);

  const [langState, setLangState] = useState(() => store.get('fh_lang') || 'en');

  useEffect(() => {
    if (user?.language && !store.get('fh_lang')) {
      setLangState(user.language);
    }
  }, [user?.language]);

  useEffect(() => { if (typeof document !== 'undefined') document.documentElement.lang = langState; }, [langState]);

  // Real-time SSE stream for instant chat, notification, and family list updates.
  useEffect(() => {
    if (status !== 'authed' || typeof window === 'undefined') return;
    let aborted = false;
    let ctrl = null;
    let retryTimer = null;
    let backoffMs = 1500;
    const famId = family?.id || null;

    const handlePayload = (detail) => {
      window.dispatchEvent(new CustomEvent('hommi:sse', { detail }));
      if (detail?.kind === 'notification') {
        window.dispatchEvent(new Event('hommi:notif'));
      } else if (detail?.kind === 'chat') {
        loadOverview().catch(() => {});
      } else if (detail?.kind) {
        notifyChanged();
      }
    };

    const connect = async () => {
      if (aborted) return;
      ctrl = new AbortController();
      try {
        let headers = getAuthHeaders();
        let res = await fetch('/api/events', { headers, credentials: 'same-origin', cache: 'no-store', signal: ctrl.signal });
        if (res.status === 401) {
          const renewed = await refreshSession();
          if (!renewed || renewed === 'offline' || aborted) throw new Error('auth');
          headers = getAuthHeaders();
          res = await fetch('/api/events', { headers, credentials: 'same-origin', cache: 'no-store', signal: ctrl.signal });
        }
        if (!res.ok || !res.body) throw new Error(`sse ${res.status}`);
        backoffMs = 1500;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const frames = buf.split('\n\n');
          buf = frames.pop() || '';
          for (const frame of frames) {
            if (!frame || frame.startsWith(':')) continue;
            let eventName = 'message';
            let dataLine = '';
            for (const line of frame.split('\n')) {
              if (line.startsWith('event:')) eventName = line.slice(6).trim();
              else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
            }
            if (eventName === 'update' && dataLine) {
              try { handlePayload(JSON.parse(dataLine)); } catch {}
            }
          }
        }
      } catch {
        // Reconnect with bounded backoff unless unmounted.
      }
      if (!aborted) {
        retryTimer = setTimeout(connect, backoffMs);
        backoffMs = Math.min(30000, backoffMs * 2);
      }
    };

    connect();
    return () => {
      aborted = true;
      clearTimeout(retryTimer);
      try { ctrl?.abort(); } catch {}
    };
  }, [status, family?.id, loadOverview]);

  const setLang = useCallback((l) => {
    store.set('fh_lang', l);
    setLangState(l);
  }, []);

  const value = useMemo(() => ({
    status, user, setUser, families, family, familyId: family?.id, me: family?.myMembershipId, myRole: family?.myRole,
    isAdmin: family ? ['owner', 'admin'].includes(family.myRole) : false,
    members: family?.members || [],
    signIn, signOut, switchFamily, reloadFamily, loadOverview, afterLogin, retryBoot: boot,
    lang: langState,
    setLang,
    t: (k) => translate(langState, k),
    tn: (text) => translateNotificationText(text, langState),
  }), [status, user, families, family, signIn, signOut, switchFamily, reloadFamily, loadOverview, afterLogin, boot, langState, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** GET with loading / error state; refetches when the family or deps change; optional polling. */
/** Anything that changes shared data calls notifyChanged(); every visible list then refreshes itself. */
export const notifyChanged = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('hommi:changed')); };

/** Deduplicates simultaneous identical GET calls across mounted components. */
const inflightGets = new Map();
function sharedGet(familyId, path) {
  const key = `${familyId || 'global'}:${path}`;
  let p = inflightGets.get(key);
  if (!p) {
    p = api('GET', path).finally(() => inflightGets.delete(key));
    inflightGets.set(key, p);
  }
  return p;
}

export function useData(path, { interval = 0, deps = [] } = {}) {
  const { familyId } = useAuth();
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const alive = useRef(true);
  const seq = useRef(0);
  const lastLoadedAt = useRef(0);
  const load = useCallback(async (quiet) => {
    if (!path) return;
    const mine = ++seq.current; // ignore answers that arrive after a newer request was started
    if (!quiet) setState((s) => ({ ...s, loading: true }));
    try {
      const data = await sharedGet(familyId, path);
      lastLoadedAt.current = Date.now();
      if (alive.current && mine === seq.current) setState({ data, error: null, loading: false });
    } catch (e) {
      if (alive.current && mine === seq.current) setState((s) => ({ data: quiet ? s.data : null, error: e, loading: false }));
    }
  }, [path, familyId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    alive.current = true;
    load(false);
    let timer;
    if (interval) timer = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, interval);
    const refresh = () => { if (document.visibilityState === 'visible') load(true); };
    const focusRefresh = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoadedAt.current > 5000) load(true);
    };
    const isNotifPath = path.startsWith('/me/notifications');
    window.addEventListener('hommi:changed', refresh);
    if (isNotifPath) window.addEventListener('hommi:notif', refresh);
    window.addEventListener('online', focusRefresh);
    document.addEventListener('visibilitychange', focusRefresh);
    return () => {
      alive.current = false; clearInterval(timer);
      window.removeEventListener('hommi:changed', refresh);
      if (isNotifPath) window.removeEventListener('hommi:notif', refresh);
      window.removeEventListener('online', focusRefresh);
      document.removeEventListener('visibilitychange', focusRefresh);
    };
  }, [load, familyId, interval, path, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    ...state,
    reload: () => load(true),
    setData: (data) => setState((s) => ({ ...s, data: typeof data === 'function' ? data(s.data) : data })),
  };
}
