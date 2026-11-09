// An invite link (/join?code=...) must survive sign-in and account creation.
export const JOIN_KEY = 'fh_join_code';
export const rememberJoinCode = (code) => { try { sessionStorage.setItem(JOIN_KEY, code); } catch { /* private mode */ } };
export const pendingJoinCode = () => { try { return sessionStorage.getItem(JOIN_KEY) || ''; } catch { return ''; } };
export const clearJoinCode = () => { try { sessionStorage.removeItem(JOIN_KEY); } catch { /* ignore */ } };
export const afterAuthPath = (families) => (pendingJoinCode() ? '/join' : families && families.length ? '/dashboard' : '/onboarding');
