'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { setVaultSession, clearVaultSession, hasVaultSession } from './session';

type AuthMethod = 'wallet' | 'email' | 'mnemonic' | null;

type User = {
  did: string;
  email?: string;
  walletAddress?: string;
};

type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  authMethod: AuthMethod;
  user: User | null;
  signIn: (method: AuthMethod, user: User) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = () => {
      if (hasVaultSession()) {
        // TODO: Load user data from IndexedDB/vault
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };

    checkSession();
  }, []);

  const signIn = (method: AuthMethod, userData: User) => {
    setAuthMethod(method);
    setUser(userData);
    setIsAuthenticated(true);
    setVaultSession();
  };

  const signOut = () => {
    clearVaultSession();
    setAuthMethod(null);
    setUser(null);
    setIsAuthenticated(false);
    // TODO: Call vault.lock() to wipe memory keys
    router.push('/');
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        authMethod,
        user,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
