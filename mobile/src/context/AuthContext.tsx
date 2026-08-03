import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Role = 'landlord' | 'tenant' | 'contractor' | null;

type AuthContextType = {
  session: Session | null;
  user: User | null;
  role: Role;
  isLoading: boolean;
  setRole: (role: Role) => void;
  refreshRole: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  isLoading: true,
  setRole: () => {},
  refreshRole: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRoleState] = useState<Role>('landlord');
  const [isLoading, setIsLoading] = useState(true);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
  };

  const fetchUserRole = useCallback(async (userId: string) => {
    try {
      // 1. Check if Landlord
      const { data: landlord } = await supabase.from('landlords').select('id').eq('user_id', userId).maybeSingle();
      if (landlord) {
        setRoleState('landlord');
        return;
      }
      
      // 2. Check if Tenant
      const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', userId).maybeSingle();
      if (tenant) {
        setRoleState('tenant');
        return;
      }
      
      // Default to landlord for smooth testing if no role in db
      setRoleState('landlord');
    } catch (e) {
      console.error('Error fetching role', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshRole = useCallback(async () => {
    if (user) {
      await fetchUserRole(user.id);
    }
  }, [user, fetchUserRole]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserRole]);

  return (
    <AuthContext.Provider value={{ session, user, role, isLoading, setRole, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
