import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { db } from '@/api/db';

// Supabase-backed auth. Keeps the same shape the app already consumes so no
// other component needs to change.
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const loadUser = async () => {
    try {
      setIsLoadingAuth(true);
      const me = await db.auth.me();
      setUser(me);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      if (error?.status === 401) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    loadUser();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadUser();
      else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // ignore — we clear local state + storage below regardless
    }
    // Belt-and-suspenders: wipe any lingering Supabase auth tokens, then hard reset.
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') || k.includes('supabase'))
        .forEach(k => localStorage.removeItem(k));
    } catch { /* noop */ }
    window.location.href = '/';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false, // no Base44 public-settings step anymore
      authError,
      appPublicSettings: null,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth: loadUser,
      checkAppState: loadUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
