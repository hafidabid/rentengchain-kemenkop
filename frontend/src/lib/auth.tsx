import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Member } from '../types';
import {
  api,
  clearStoredMember,
  clearToken,
  getStoredMember,
  getToken,
  setStoredMember,
  setToken,
} from './api';

interface AuthContextValue {
  member: Member | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<Member>;
  logout: () => void;
  refreshMember: (m: Member) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(() => getStoredMember());
  const [loading, setLoading] = useState<boolean>(() => Boolean(getToken()));

  // On first mount, if we have a token, revalidate it against /auth/me.
  useEffect(() => {
    let cancelled = false;
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((fresh) => {
        if (cancelled) return;
        setMember(fresh);
        setStoredMember(fresh);
      })
      .catch(() => {
        if (cancelled) return;
        clearToken();
        clearStoredMember();
        setMember(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await api.login(identifier, password);
    setToken(result.accessToken);
    setStoredMember(result.member);
    setMember(result.member);
    return result.member;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    clearStoredMember();
    setMember(null);
  }, []);

  const refreshMember = useCallback((m: Member) => {
    setMember(m);
    setStoredMember(m);
  }, []);

  const value = useMemo(
    () => ({ member, loading, login, logout, refreshMember }),
    [member, loading, login, logout, refreshMember],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
