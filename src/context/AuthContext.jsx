import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import { setSessionExpiredHandler } from '../services/apiClient';
import { SESSION_KEY } from '../services/session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => authService.getSession());
  // True after the server ended the session, so the login page can say why.
  const [sessionExpired, setSessionExpired] = useState(false);
  const isAuthenticated = Boolean(session);

  // Any API call that finds the session can't be renewed signs the user out here.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setSession(null);
      setSessionExpired(true);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  // Keep tabs in step: signing in or out in one tab applies to the others.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === null || e.key === SESSION_KEY) setSession(authService.getSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // On load, confirm the stored session with the server and refresh the user's details.
  useEffect(() => {
    if (!isAuthenticated) return;
    authService
      .fetchCurrentUser()
      .then((user) => setSession((s) => (s ? { ...s, user } : s)))
      .catch((err) => {
        // 403: the account is no longer an admin. (401 is handled by the expired handler.)
        if (err.status === 403) {
          authService.logout();
          setSession(null);
        }
      });
  }, [isAuthenticated]);

  const login = useCallback(async (email, password, remember) => {
    const next = await authService.login(email, password, remember);
    setSessionExpired(false);
    setSession(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setSessionExpired(false);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ user: session?.user ?? null, isAuthenticated, sessionExpired, login, logout }),
    [session, isAuthenticated, sessionExpired, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
