'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, get, post, setAccessToken, setActiveFamily, setSessionLostHandler, refreshSession, clearPrivateCaches } from '@/lib/api';
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
  const [status, setStatus] = useState('loading'); // loading | anon | authed
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

  useEffect(() => {
    setSessionLostHandler(() => { setUser(null); setFamily(null); setFamilies([]); setStatus('anon'); });
    (async () => {
      const u = await refreshSession();
      if (!u) { setStatus('anon'); return; }
      try { await afterLogin(u); } catch { setStatus('anon'); }
    })();
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, [afterLogin]);

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
    setUser(null); setFamily(null); setFamilies([]); setStatus('anon');
    router.replace('/login');
  }, [router]);

  const switchFamily = useCallback(async (id) => { await loadFamily(id); await loadOverview(); }, [loadFamily, loadOverview]);
  const reloadFamily = useCallback(async () => { if (familyIdRef.current) { await loadFamily(familyIdRef.current); await loadOverview(); } }, [loadFamily, loadOverview]);

  const [langState, setLangState] = useState(() => store.get('fh_lang') || 'en');

  useEffect(() => {
    if (user?.language && !store.get('fh_lang')) {
      setLangState(user.language);
    }
  }, [user?.language]);

  const setLang = useCallback((l) => {
    store.set('fh_lang', l);
    setLangState(l);
  }, []);

  const value = useMemo(() => ({
    status, user, setUser, families, family, familyId: family?.id, me: family?.myMembershipId, myRole: family?.myRole,
    isAdmin: family ? ['owner', 'admin'].includes(family.myRole) : false,
    members: family?.members || [],
    signIn, signOut, switchFamily, reloadFamily, loadOverview, afterLogin,
    lang: langState,
    setLang,
    t: (k) => translate(langState, k),
    tn: (text) => translateNotificationText(text, langState),
  }), [status, user, families, family, signIn, signOut, switchFamily, reloadFamily, loadOverview, afterLogin, langState, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** GET with loading / error state; refetches when the family or deps change; optional polling. */
export function useData(path, { interval = 0, deps = [] } = {}) {
  const { familyId } = useAuth();
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const alive = useRef(true);
  const load = useCallback(async (quiet) => {
    if (!path) return;
    if (!quiet) setState((s) => ({ ...s, loading: true }));
    try {
      const data = await api('GET', path);
      if (alive.current) setState({ data, error: null, loading: false });
    } catch (e) {
      if (alive.current) setState((s) => ({ data: quiet ? s.data : null, error: e, loading: false }));
    }
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    alive.current = true;
    load(false);
    let timer;
    if (interval) timer = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, interval);
    return () => { alive.current = false; clearInterval(timer); };
  }, [load, familyId, interval, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: () => load(true), setData: (data) => setState((s) => ({ ...s, data })) };
}
