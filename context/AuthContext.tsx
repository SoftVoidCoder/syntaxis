import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { loginWithFirebase, logoutFirebase, getUserById } from '../services/firebaseService';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  updateUser: (updatedData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load User from LocalStorage on mount AND sync with Server
  useEffect(() => {
    const initAuth = async () => {
      const stored = localStorage.getItem('korda_user');
      if (stored) {
        try {
          const localUser = JSON.parse(stored);
          setUser(localUser); // Immediate UI feedback from cache

          // Background Sync: Fetch fresh data from DB to ensure Webhook is up to date
          // This fixes the issue where old localStorage overwrites fresh DB data
          try {
            // We need to dynamically import or use the service function. 
            // Since we can't import inside useEffect easily without circular deps issues if not careful,
            // we rely on the imported getUserById.
            // Note: We need to export getUserById from firebaseService first (done in previous step).
            const { getUserById } = await import('../services/firebaseService');
            const freshUser = await getUserById(localUser.id);

            if (freshUser) {
              if (freshUser.isBlocked) {
                console.warn("User is blocked. Forcing logout.");
                localStorage.removeItem('korda_user');
                setUser(null);
                return;
              }
              console.log("AuthContext: Synced user from DB", freshUser);
              setUser(freshUser);
              localStorage.setItem('korda_user', JSON.stringify(freshUser));
            }
          } catch (syncErr) {
            console.warn("AuthContext: Background sync failed", syncErr);
          }
        } catch (e) {
          console.error("Failed to parse stored user", e);
          localStorage.removeItem('korda_user');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<string | null> => {
    try {
      const loggedInUser = await loginWithFirebase(username, password);
      localStorage.setItem('korda_user', JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      return null;
    } catch (error: any) {
      console.error("Login failed", error);
      return error.message || "Ошибка авторизации";
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('korda_user');
      setUser(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const updateUser = (updatedData: Partial<User>) => {
    if (!user) return;
    const newUser = { ...user, ...updatedData };
    setUser(newUser);
    localStorage.setItem('korda_user', JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading, updateUser }}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
