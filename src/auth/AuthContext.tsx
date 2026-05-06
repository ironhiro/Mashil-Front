import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { UserRole } from "../lib/enums";

export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
}

interface AuthState {
    user: AuthUser | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, displayName?: string) => Promise<void>;
    logout: () => void;
}

const TOKEN_KEY = "mashil_token";
const USER_KEY = "mashil_user";

const AuthCtx = createContext<AuthState | null>(null);

interface AuthResponse {
    token: string;
    userId: string;
    email: string;
    role: UserRole;
}

async function postAuth(path: string, payload: object): Promise<AuthResponse> {
    const res = await fetch(`/api/auth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
    const [user, setUser] = useState<AuthUser | null>(() => {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? (JSON.parse(raw) as AuthUser) : null;
    });

    useEffect(() => {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    }, [token]);

    useEffect(() => {
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
        else localStorage.removeItem(USER_KEY);
    }, [user]);

    const login = useCallback(async (email: string, password: string) => {
        const res = await postAuth("login", { email, password });
        setToken(res.token);
        setUser({ id: res.userId, email: res.email, role: res.role });
    }, []);

    const register = useCallback(async (email: string, password: string, displayName?: string) => {
        const res = await postAuth("register", { email, password, displayName });
        setToken(res.token);
        setUser({ id: res.userId, email: res.email, role: res.role });
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
    }, []);

    const value = useMemo<AuthState>(
        () => ({ user, token, login, register, logout }),
        [user, token, login, register, logout],
    );

    return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
    const ctx = useContext(AuthCtx);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}

/** 인증 헤더가 필요한 fetch 호출이 토큰을 가져갈 모듈 게이트 — 함수 호출 시점의 최신 값을 읽음. */
export function readAuthToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}
