import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { dbClient, isDatabaseConnected, type Session } from '@/lib/dbClient';
import type { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_PROFILES: Record<string, Profile> = {
  'admin@aivsupport.com': {
    id: '11111111-1111-1111-1111-111111111111',
    account_id: null,
    auth_uid: '11111111-1111-1111-1111-111111111111',
    email: 'admin@aivsupport.com',
    first_name: 'System',
    last_name: 'Admin',
    user_type: 'admin',
    status: 'active',
    phone: null,
    job_title: 'System Administrator',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    activated_at: new Date().toISOString(),
  },
  'manager@aivsupport.com': {
    id: '22222222-2222-2222-2222-222222222222',
    account_id: null,
    auth_uid: '22222222-2222-2222-2222-222222222222',
    email: 'manager@aivsupport.com',
    first_name: 'Support',
    last_name: 'Manager',
    user_type: 'manager',
    status: 'active',
    phone: null,
    job_title: 'Support Operations Manager',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    activated_at: new Date().toISOString(),
  },
  'agent1@aivsupport.com': {
    id: '33333333-3333-3333-3333-333333333333',
    account_id: null,
    auth_uid: '33333333-3333-3333-3333-333333333333',
    email: 'agent1@aivsupport.com',
    first_name: 'Sarah',
    last_name: 'Connor',
    user_type: 'agent',
    status: 'active',
    phone: null,
    job_title: 'Senior Support Specialist',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    activated_at: new Date().toISOString(),
  },
  'agent2@aivsupport.com': {
    id: '44444444-4444-4444-4444-444444444444',
    account_id: null,
    auth_uid: '44444444-4444-4444-4444-444444444444',
    email: 'agent2@aivsupport.com',
    first_name: 'Alex',
    last_name: 'Murphy',
    user_type: 'agent',
    status: 'active',
    phone: null,
    job_title: 'Support Engineer',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    activated_at: new Date().toISOString(),
  },
  'john.smith@acme.com': {
    id: '55555555-5555-5555-5555-555555555555',
    account_id: 'a0000000-0000-0000-0000-000000000001',
    auth_uid: '55555555-5555-5555-5555-555555555555',
    email: 'john.smith@acme.com',
    first_name: 'John',
    last_name: 'Smith',
    user_type: 'customer_user',
    status: 'active',
    phone: null,
    job_title: 'IT Lead',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    activated_at: new Date().toISOString(),
  },
  'alice@globex.com': {
    id: '66666666-6666-6666-6666-666666666666',
    account_id: 'a0000000-0000-0000-0000-000000000002',
    auth_uid: '66666666-6666-6666-6666-666666666666',
    email: 'alice@globex.com',
    first_name: 'Alice',
    last_name: 'Johnson',
    user_type: 'customer_admin',
    status: 'active',
    phone: null,
    job_title: 'VP Technology',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    activated_at: new Date().toISOString(),
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }

    const savedProfile = localStorage.getItem('demo_profile');
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
        return;
      } catch (e) {
        // ignore
      }
    }

    const attemptFetch = async (): Promise<Profile | null> => {
      try {
        const { data, error } = await dbClient
          .from('profiles')
          .select('*')
          .eq('auth_uid', session.user.id)
          .maybeSingle();
        if (error) return null;
        if (data) return data as Profile;

        const { data: emailProfile } = await dbClient
          .from('profiles')
          .select('*')
          .eq('email', session.user.email ?? '')
          .maybeSingle();
        return (emailProfile as Profile) ?? null;
      } catch (e) {
        return null;
      }
    };

    let profile: Profile | null = null;
    for (let i = 0; i < 3; i++) {
      profile = await attemptFetch();
      if (profile) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    setProfile(profile);
  }, [session]);

  useEffect(() => {
    const isExplicitLogin = localStorage.getItem('explicit_login') === 'true';
    if (!isExplicitLogin) {
      localStorage.removeItem('demo_session');
      localStorage.removeItem('demo_profile');
    }

    const localDemoSession = isExplicitLogin ? localStorage.getItem('demo_session') : null;
    if (localDemoSession) {
      try {
        const parsedSession = JSON.parse(localDemoSession);
        setSession(parsedSession);
        const savedProfile = localStorage.getItem('demo_profile');
        if (savedProfile) {
          setProfile(JSON.parse(savedProfile));
        }
        setLoading(false);
        return;
      } catch (e) {
        localStorage.removeItem('demo_session');
        localStorage.removeItem('demo_profile');
        localStorage.removeItem('explicit_login');
      }
    }

    dbClient.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
      } else {
        setSession(null);
        setProfile(null);
      }
      setLoading(false);
    }).catch(() => {
      setSession(null);
      setProfile(null);
      setLoading(false);
    });

    const { data: { subscription } } = dbClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && !profile) {
      setLoading(true);
      fetchProfile().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [session, profile, fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await dbClient.auth.signInWithPassword({ email, password });
      if (error) {
        return { error: error.message || 'Invalid login credentials' };
      }
      if (data.session) {
        localStorage.setItem('explicit_login', 'true');
        localStorage.setItem('demo_session', JSON.stringify(data.session));
        setSession(data.session);
        await fetchProfile();
        return { error: null };
      }
      return { error: 'Login failed. Please check your credentials.' };
    } catch (err: any) {
      return { error: err.message || 'Network error during sign in' };
    }
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const { data, error } = await dbClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });
      if (error) {
        return { error: error.message || 'Registration failed' };
      }
      if (data && data.session) {
        localStorage.setItem('explicit_login', 'true');
        localStorage.setItem('demo_session', JSON.stringify(data.session));
        setSession(data.session);
        await fetchProfile();
        return { error: null };
      }
      return { error: 'Registration could not be completed.' };
    } catch (err: any) {
      return { error: err.message || 'Network error during registration' };
    }
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      await dbClient.auth.signOut();
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('explicit_login');
    localStorage.removeItem('demo_session');
    localStorage.removeItem('demo_profile');
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
