import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/index';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null; sessionId?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** id ของ work session ที่ active อยู่ */
  activeSessionId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('*, role:roles(*)')
    .eq('id', userId)
    .maybeSingle();
  return data as UserProfile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const refreshProfile = async () => {
    if (!user) { setProfile(null); return; }
    const p = await loadProfile(user.id);
    setProfile(p);
  };

  // เริ่ม work session เมื่อ login
  const startSession = async (userId: string) => {
    const { data } = await supabase
      .from('work_sessions')
      .insert({ user_id: userId, login_at: new Date().toISOString() })
      .select('id')
      .maybeSingle();
    if (data) setActiveSessionId(data.id);
  };

  // จบ work session เมื่อ logout
  const endSession = async (sessionId: string) => {
    await supabase
      .from('work_sessions')
      .update({ logout_at: new Date().toISOString() })
      .eq('id', sessionId);
    setActiveSessionId(null);
  };

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.user.id).then(setProfile);
        }
      })
      .finally(() => setLoading(false));

    // In this function, do NOT use any await calls. Use `.then()` instead to avoid deadlocks.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id).then(setProfile);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // จัดการ beforeunload เพื่อบันทึก logout อัตโนมัติเมื่อปิดหน้าต่าง
  useEffect(() => {
    if (!activeSessionId) return;
    const handleUnload = () => {
      // ใช้ sendBeacon สำหรับ async ที่ไม่ block
      const payload = JSON.stringify({ session_id: activeSessionId });
      navigator.sendBeacon?.(`/api/logout-session?id=${activeSessionId}`, payload);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [activeSessionId]);

  const signInWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username.toLowerCase().trim()}@gtav-queue.app`;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        const p = await loadProfile(data.user.id);
        setProfile(p);
        await startSession(data.user.id);
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    if (activeSessionId) await endSession(activeSessionId);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithUsername, signOut, refreshProfile, activeSessionId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
