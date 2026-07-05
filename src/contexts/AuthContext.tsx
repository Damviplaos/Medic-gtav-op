/**
 * AuthContext – ระบบ auth แบบ file-based (localStorage)
 * ไม่ใช้ Supabase Auth เลย
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  initStore, sha256Hex,
  storeGetUserByUsername, storeGetUsers, hydrateUser,
  storeStartSession, storeEndSession,
  subscribeStore,
} from '@/store/store';
import type { UserProfile } from '@/types/index';

const SESSION_KEY = 'gtav_current_session';
interface LocalSession { userId: string; sessionId: string; }

// user มีแค่ id เพื่อ backward-compat กับ pages ที่เช็ค if (!user)
type SimpleUser = { id: string };

interface AuthContextType {
  user: SimpleUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => void;
  refreshProfile: () => void;
  activeSessionId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const loadFromSession = useCallback(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) { setUser(null); setProfile(null); return; }
    const { userId } = JSON.parse(raw) as LocalSession;
    const u = storeGetUsers().find(x => x.id === userId);
    if (u) {
      setUser({ id: u.id });
      setProfile(hydrateUser(u));
    } else {
      localStorage.removeItem(SESSION_KEY);
      setUser(null);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(() => { loadFromSession(); }, [loadFromSession]);

  useEffect(() => {
    initStore().then(() => {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const { userId, sessionId } = JSON.parse(raw) as LocalSession;
        const u = storeGetUsers().find(x => x.id === userId);
        if (u) {
          setUser({ id: u.id });
          setProfile(hydrateUser(u));
          setActiveSessionId(sessionId);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
      setLoading(false);
    });
    return subscribeStore(loadFromSession);
  }, [loadFromSession]);

  useEffect(() => {
    if (!activeSessionId) return;
    const handleUnload = () => storeEndSession(activeSessionId);
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [activeSessionId]);

  const signInWithUsername = async (username: string, password: string) => {
    try {
      const stored = storeGetUserByUsername(username);
      if (!stored) throw new Error('Invalid login credentials');
      const hash = await sha256Hex(password);
      if (hash !== stored.password_hash) throw new Error('Invalid login credentials');
      const sessionId = storeStartSession(stored.id);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: stored.id, sessionId } satisfies LocalSession));
      setUser({ id: stored.id });
      setProfile(hydrateUser(stored));
      setActiveSessionId(sessionId);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = () => {
    if (activeSessionId) storeEndSession(activeSessionId);
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setProfile(null);
    setActiveSessionId(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithUsername, signOut, refreshProfile, activeSessionId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
