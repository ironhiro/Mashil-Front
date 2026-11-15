import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { UserRole } from "../lib/enums";
import { USE_MOCK } from "../mock/flag";
import i18n from "../i18n";
import { appPlatform, nativeSignIn, nativeSignOut } from "../lib/nativeBridge";
import type { SocialProvider } from "../lib/nativeBridge";

export interface AuthUser {
    id: string;
    /** 레거시 로그인·/me 에서만 옴. 소셜 로그인은 제공자에 따라 없을 수 있음. */
    email?: string | null;
    displayName?: string | null;
    role: UserRole;
    /** 소셜 로그인으로 들어왔으면 그 제공자 (로그아웃 시 앱 SDK 세션도 정리). */
    provider?: SocialProvider;
}

/** 화면에 보여줄 사용자 이름. */
export function userLabel(u: AuthUser): string {
    return u.displayName || u.email || i18n.t("app.defaultUserName");
}

export interface SocialLoginResult {
    isNewUser: boolean;
    consentRequired: boolean;
}

interface AuthState {
    user: AuthUser | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, displayName?: string) => Promise<void>;
    /** 앱 브리지로 네이티브 소셜 로그인 → 서버 교환. 취소하면 NativeSignInCancelled. */
    loginWithProvider: (provider: SocialProvider) => Promise<SocialLoginResult>;
    /** 표시 이름이 바뀌었을 때 (약관 동의 화면 등) 화면 상태만 갱신 */
    setDisplayName: (name: string) => void;
    logout: () => void;
}

const TOKEN_KEY = "mashil_token";
const REFRESH_KEY = "mashil_refresh";
const USER_KEY = "mashil_user";

const AuthCtx = createContext<AuthState | null>(null);

/** 백엔드 TokenResponse (docs/API.md). email 은 레거시 목업에만 있음. */
interface AuthResponse {
    token: string;
    refreshToken?: string;
    userId: string;
    displayName?: string | null;
    email?: string | null;
    role: UserRole;
    isNewUser?: boolean;
    consentRequired?: boolean | null;
}

interface MeResponse {
    email: string | null;
    displayName: string | null;
}

async function fetchMe(token: string): Promise<MeResponse | null> {
    if (USE_MOCK) return null;
    try {
        const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        return res.ok ? ((await res.json()) as MeResponse) : null;
    } catch {
        return null;
    }
}

async function fetchNonce(): Promise<string> {
    const res = await fetch("/api/auth/nonce");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return ((await res.json()) as { nonce: string }).nonce;
}

async function postAuth(path: string, payload: object): Promise<AuthResponse> {
    if (USE_MOCK) {
        const { mockFetch } = await import("../mock/mockApi");
        return mockFetch<AuthResponse>(`/api/auth/${path}`, "POST", payload);
    }
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

    // apiFetch 가 토큰을 갱신했거나 세션이 끝났으면 화면 상태도 따라간다
    useEffect(() => {
        const onToken = (e: Event) => setToken((e as CustomEvent<string>).detail);
        const onExpired = () => {
            setToken(null);
            setUser(null);
        };
        window.addEventListener(TOKEN_EVENT, onToken);
        window.addEventListener(EXPIRED_EVENT, onExpired);
        return () => {
            window.removeEventListener(TOKEN_EVENT, onToken);
            window.removeEventListener(EXPIRED_EVENT, onExpired);
        };
    }, []);

    const applyResponse = useCallback(async (res: AuthResponse, extra: Partial<AuthUser>) => {
        const me = res.email === undefined ? await fetchMe(res.token) : null;
        if (res.refreshToken) localStorage.setItem(REFRESH_KEY, res.refreshToken);
        else localStorage.removeItem(REFRESH_KEY);
        setToken(res.token);
        setUser({
            id: res.userId,
            email: res.email ?? me?.email ?? null,
            displayName: me?.displayName ?? res.displayName ?? null,
            role: res.role,
            ...extra,
        });
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const res = await postAuth("login", { email, password });
        await applyResponse(res, {});
    }, [applyResponse]);

    const register = useCallback(async (email: string, password: string, displayName?: string) => {
        const res = await postAuth("register", { email, password, displayName });
        await applyResponse(res, {});
    }, [applyResponse]);

    const loginWithProvider = useCallback(async (provider: SocialProvider): Promise<SocialLoginResult> => {
        const nonce = await fetchNonce();
        const c = await nativeSignIn(provider, nonce);
        const res = await postAuth(`oauth/${provider}`, {
            idToken: c.idToken,
            accessToken: c.accessToken,
            authorizationCode: c.authorizationCode,
            nonce,
            device: appPlatform() ?? "web",
            displayName: c.displayName,
        });
        await applyResponse(res, { provider });
        return { isNewUser: !!res.isNewUser, consentRequired: !!res.consentRequired };
    }, [applyResponse]);

    const logout = useCallback(() => {
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        localStorage.removeItem(REFRESH_KEY);
        if (refreshToken && !USE_MOCK) {
            // 서버 세션 폐기 — 실패해도 로컬 로그아웃은 진행
            void fetch("/api/auth/logout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken }),
            }).catch(() => undefined);
        }
        if (user?.provider) void nativeSignOut(user.provider);
        setToken(null);
        setUser(null);
    }, [user]);

    const setDisplayName = useCallback((name: string) => {
        setUser((u) => (u ? { ...u, displayName: name } : u));
    }, []);

    const value = useMemo<AuthState>(
        () => ({ user, token, login, register, loginWithProvider, setDisplayName, logout }),
        [user, token, login, register, loginWithProvider, setDisplayName, logout],
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

/** 토큰이 바뀌었거나(갱신) 세션이 끝났을 때 AuthProvider 에 알리는 창 이벤트 */
const TOKEN_EVENT = "mashil:auth-token";
const EXPIRED_EVENT = "mashil:auth-expired";

let refreshing: Promise<string | null> | null = null;

/**
 * 액세스 토큰(30분)이 만료됐을 때 refresh token 으로 새 쌍을 받는다.
 * 서버는 refresh token 을 회전시키고, 이미 쓴 토큰을 다시 보내면 세션을 끊으므로 **한 번에 하나만** 보낸다
 * (동시에 여러 요청이 401 을 받아도 같은 갱신을 기다린다).
 * 새 액세스 토큰을 돌려준다. 서버가 거절하면(세션 끝) 로컬 로그인 정보를 지우고 null.
 * 네트워크 오류면 로그인 정보는 그대로 두고 null.
 */
export function refreshAccessToken(): Promise<string | null> {
    if (USE_MOCK) return Promise.resolve(null);
    refreshing ??= (async () => {
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        if (!refreshToken) return null;
        let res: Response;
        try {
            res = await fetch("/api/auth/refresh", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken }),
            });
        } catch {
            return null;
        }
        if (!res.ok) {
            if (res.status === 400 || res.status === 401) {
                localStorage.removeItem(REFRESH_KEY);
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(USER_KEY);
                window.dispatchEvent(new Event(EXPIRED_EVENT));
            }
            return null;
        }
        const body = (await res.json()) as AuthResponse;
        localStorage.setItem(TOKEN_KEY, body.token);
        if (body.refreshToken) localStorage.setItem(REFRESH_KEY, body.refreshToken);
        window.dispatchEvent(new CustomEvent<string>(TOKEN_EVENT, { detail: body.token }));
        return body.token;
    })().finally(() => {
        refreshing = null;
    });
    return refreshing;
}
