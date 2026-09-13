import React, { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL, apiFetch, getAuthToken, setAuthToken, removeAuthToken } from "@/lib/api";

export interface GuildItem {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  canManage: boolean;
  botJoined: boolean;
  inviteUrl: string;
}

export interface UserProfile {
  id: string;
  username: string;
  globalName: string;
  avatar: string | null;
  isDev?: boolean;
  guilds: GuildItem[];
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  hasSecretConfigured: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSecretConfigured, setHasSecretConfigured] = useState(false);

  // Check URL code (direct SPA redirect) and complete the cookie-backed session flow
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get("code");
    const stateFromUrl = urlParams.get("state");

    if (codeFromUrl) {
      setLoading(true);
      const redirectUri = window.location.origin + window.location.pathname;
      apiFetch("/api/auth/exchange", {
        method: "POST",
        body: JSON.stringify({ code: codeFromUrl, redirect_uri: redirectUri, state: stateFromUrl })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setUser(data.user);
          }
        })
        .catch((err) => console.error("Code exchange error:", err))
        .finally(() => {
          urlParams.delete("code");
          urlParams.delete("state");
          const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
          window.history.replaceState({}, document.title, newUrl);
          setLoading(false);
        });
    } else {
      refreshUser();
    }
  }, []);

  const refreshUser = async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setHasSecretConfigured(!!data.hasSecretConfigured);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to fetch current user session:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    window.location.href = `${API_BASE_URL}/api/auth/login`;
  };

  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    setUser(null);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        hasSecretConfigured,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
