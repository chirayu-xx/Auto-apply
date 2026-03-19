'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api } from './api';

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  location?: string;
  desiredRoles: string[];
  experienceLevel?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('auth');
    if (stored) {
      try {
        const { accessToken, refreshToken, user: u } = JSON.parse(stored);
        setToken(accessToken);
        setUser(u);
        // Verify token is still valid
        api.auth.me(accessToken).then((freshUser) => {
          setUser(freshUser);
        }).catch(() => {
          // Try refresh
          api.auth.refresh(refreshToken).then(({ accessToken: newToken, refreshToken: newRefresh }) => {
            setToken(newToken);
            localStorage.setItem('auth', JSON.stringify({ accessToken: newToken, refreshToken: newRefresh, user: u }));
            return api.auth.me(newToken);
          }).then((freshUser) => {
            setUser(freshUser);
          }).catch(() => {
            localStorage.removeItem('auth');
            setToken(null);
            setUser(null);
          });
        });
      } catch {
        localStorage.removeItem('auth');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login({ email, password });
    setToken(result.accessToken);
    setUser(result.user);
    localStorage.setItem('auth', JSON.stringify(result));
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const result = await api.auth.register({ email, password, name });
    setToken(result.accessToken);
    setUser(result.user);
    localStorage.setItem('auth', JSON.stringify(result));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
