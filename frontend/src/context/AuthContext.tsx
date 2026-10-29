'use client';

import { AUTH_COOKIE_NAME } from "@/lib/authCookie";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { checkUserPermission } from '@/lib/access/permissions';
import {organizationRequests,type OrganizationGroup} from '@/lib/access/organizationScope';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  roleId?: number;
  roleName: string;
  employeeId?: number | null;
  permissions?: string[];
  mustChangePassword?: boolean;
  availableGroups?:OrganizationGroup[];
  organizationAccess?:{groupIds:number[];isGlobalAdministrator:boolean};
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  hasPermission: (permissionCode: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken) {
          setToken(storedToken);
          document.cookie = `${AUTH_COOKIE_NAME}=${storedToken}; path=/; max-age=86400; SameSite=Lax`;
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
          // Verify token with backend and sync latest permissions & role
          try {
            const meRes = await api.get<{
              user?: {
                userId?: number;
                id?: number;
                username?: string;
                email: string;
                fullName?: string;
                roleId?: number;
                roleName: string;
                permissions?: string[];
                mustChangePassword?: boolean;
              };
            }>('/auth/me');

            if (meRes?.user) {
              const updatedUser: User = {
                id: meRes.user.userId ?? meRes.user.id ?? 0,
                username: meRes.user.username || (storedUser ? JSON.parse(storedUser).username : ''),
                email: meRes.user.email,
                fullName: meRes.user.fullName || (storedUser ? JSON.parse(storedUser).fullName : meRes.user.email),
                roleId: meRes.user.roleId,
                roleName: meRes.user.roleName,
                permissions: meRes.user.permissions || [],
                mustChangePassword: Boolean(meRes.user.mustChangePassword),
              };
              setUser(updatedUser);
              localStorage.setItem('user', JSON.stringify(updatedUser));
            }
          } catch {
            // Token might be expired or invalid
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            document.cookie = `${AUTH_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; SameSite=Lax`;
            setToken(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Failed to restore auth session', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    organizationRequests.change(null,true);
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    document.cookie = `${AUTH_COOKIE_NAME}=${newToken}; path=/; max-age=86400; SameSite=Lax`;
  };

  const logout = () => {
    organizationRequests.change(null,true);
    setToken(null);
    setUser(null);
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.clear();
    } catch {
      // Ignore storage errors
    }
    // Clear all possible cookie names and scopes
    const expireStr = "expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; path=/;";
    document.cookie = `${AUTH_COOKIE_NAME}=;${expireStr} SameSite=Lax`;
    document.cookie = `token=;${expireStr} SameSite=Lax`;
    document.cookie = `gajianich_prod_token=;${expireStr} SameSite=Lax`;
    router.replace('/login');
  };

  const hasPermission = (permissionCode: string): boolean => {
    return checkUserPermission(user, permissionCode);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, hasPermission }}>
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
