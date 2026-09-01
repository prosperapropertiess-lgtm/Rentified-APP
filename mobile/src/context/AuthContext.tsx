import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Role = 'owner' | 'tenant' | 'contractor' | 'new_user' | null;

type AuthContextType = {
  session: Session | null;
  user: User | null;
  role: Role;
  profileId: string | null;
  isLoading: boolean;
  roleError: boolean;
  setRole: (role: Role) => void;
  refreshRole: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  profileId: null,
  isLoading: true,
  roleError: false,
  setRole: () => {},
  refreshRole: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRoleState] = useState<Role>('owner');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roleError, setRoleError] = useState(false);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
  };

  const fetchUserRole = useCallback(async (userId: string) => {
    try {
      // 1. Check if Landlord
      const { data: landlord, error: landlordError } = await supabase.from('landlords').select('id').eq('user_id', userId).maybeSingle();
      if (landlordError) throw landlordError;
      if (landlord) {
        setRoleState('owner');
        setProfileId(landlord.id);
        setRoleError(false);
        return;
      }

      // 2. Check if Tenant
      const { data: tenant, error: tenantError } = await supabase.from('tenants').select('id').eq('user_id', userId).maybeSingle();
      if (tenantError) throw tenantError;
      if (tenant) {
        setRoleState('tenant');
        setProfileId(tenant.id);
        setRoleError(false);
        return;
      }

      // 3. New User (needs onboarding) — only reached when both lookups
      // genuinely returned zero rows, not when they failed.
      setRoleState('new_user');
      setProfileId(null);
      setRoleError(false);
    } catch (e) {
      // A failed lookup is NOT the same as "this user has no account yet."
      // Treating them the same routes an existing owner/resident into
      // onboarding on a transient network blip — and if they resubmit that
      // form, a second landlords/tenants row gets created for the same
      // user_id, which then makes .maybeSingle() error on every future
      // login and permanently locks the account in an onboarding loop.
      // So: surface a real retryable error instead of guessing 'new_user'.
      console.error('Error fetching role', e);
      setRoleState(null);
      setRoleError(true);
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
    <AuthContext.Provider value={{ session, user, role, profileId, isLoading, roleError, setRole, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
