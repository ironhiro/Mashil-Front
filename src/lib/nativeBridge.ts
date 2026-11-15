/**
 * Flutter 앱 셸(Mashil-app)과의 JS 브리지.
 *
 * - 웹 → 앱: window.MashilBridge.postMessage(JSON.stringify({ requestId, method, params }))
 * - 앱 → 웹: window.__mashilBridgeReply(requestId, result)
 *
 * 앱은 페이지 로드 전에 채널을 붙이므로 `isApp()` 은 첫 렌더부터 정확하다.
 * 브라우저에서는 모든 호출이 reject 되고, 아래 헬퍼들은 웹 API 로 폴백한다.
 */

import i18n from "../i18n";
import { UserFacingError } from "./friendlyError";

export type BridgeReply = Record<string, unknown> & { ok: boolean; reason?: string };

export type SocialProvider = "kakao" | "google" | "apple";

interface MashilWindow {
    MashilBridge?: { postMessage: (msg: string) => void };
    __mashilBridgeReply?: (requestId: string, result: BridgeReply) => void;
}

const w = window as unknown as MashilWindow;
const pending = new Map<string, (r: BridgeReply) => void>();

w.__mashilBridgeReply = (id, result) => {
    const resolve = pending.get(id);
    if (!resolve) return;
    pending.delete(id);
    resolve(result);
};

export function isApp(): boolean {
    return typeof w.MashilBridge?.postMessage === "function";
}

export function callNative(method: string, params: object = {}, timeoutMs = 120_000): Promise<BridgeReply> {
    return new Promise((resolve, reject) => {
        if (!isApp()) {
            reject(new Error("not in app"));
            return;
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const timer = setTimeout(() => {
            if (pending.delete(id)) reject(new Error(`bridge timeout: ${method}`));
        }, timeoutMs);
        pending.set(id, (r) => {
            clearTimeout(timer);
            resolve(r);
        });
        w.MashilBridge!.postMessage(JSON.stringify({ requestId: id, method, params }));
    });
}

// ── 위치 ────────────────────────────────────────────────────────────────

export interface Position {
    lat: number;
    lng: number;
    accuracy?: number;
    /** 새로 잰 것이 아니라 기기가 기억하던 위치 (maximumAge 안). 정확한 위치는 다시 재야 한다 */
    cached?: boolean;
}

export type LocationFailure = "denied" | "deniedForever" | "serviceDisabled" | "timeout" | "unsupported" | "failed";

export class LocationError extends Error {
    readonly reason: LocationFailure;
    constructor(reason: LocationFailure) {
        super(i18n.t(`location.${reason}`));
        this.reason = reason;
    }
}

const LOCATION_FAILURES: LocationFailure[] = ["denied", "deniedForever", "serviceDisabled", "timeout", "unsupported", "failed"];

/** 앱이면 네이티브 GPS(권한 요청 포함), 아니면 navigator.geolocation (APP-03). */
export async function getCurrentPosition(
    opts: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number } = {},
): Promise<Position> {
    if (isApp()) {
        // 예전 앱은 이 파라미터를 무시하고 정밀 측정만 한다 (cached 도 오지 않음)
        const r = await callNative(
            "getLocation",
            { maximumAgeMs: opts.maximumAge ?? 0, highAccuracy: opts.enableHighAccuracy ?? true, timeoutMs: opts.timeout },
            Math.max(opts.timeout ?? 0, 30_000),
        );
        if (r.ok) return { lat: Number(r.lat), lng: Number(r.lng), accuracy: Number(r.accuracy), cached: r.cached === true };
        const reason = (r.reason as LocationFailure) ?? "failed";
        throw new LocationError(LOCATION_FAILURES.includes(reason) ? reason : "failed");
    }
    if (!navigator.geolocation) throw new LocationError("unsupported");
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (pos) =>
                resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    // 브라우저는 캐시 여부를 따로 알려 주지 않으므로 잰 시각으로 판단
                    cached: Date.now() - pos.timestamp > 5_000,
                }),
            (err) =>
                reject(
                    new LocationError(
                        err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "failed",
                    ),
                ),
            opts,
        );
    });
}

/** 앱의 설정 화면 열기 (deniedForever 일 때). */
export function openAppSettings(): Promise<BridgeReply> {
    return callNative("openSettings");
}

// ── 언어 ────────────────────────────────────────────────────────────────

/**
 * 앱 네이티브 화면(오류 화면, 업데이트 안내 등)의 언어를 웹과 맞춘다. 앱이 저장해서 다음 실행에도 유지.
 * 브라우저거나 이 기능이 없는 예전 앱이면 아무 일도 하지 않는다.
 */
export async function setAppLanguage(language: string): Promise<void> {
    if (!isApp()) return;
    try {
        const r = await callNative("setLanguage", { language }, 10_000);
        if (!r.ok) console.warn("[mashil] setLanguage:", r.reason);
    } catch (e) {
        console.warn("[mashil] setLanguage failed", e);
    }
}

// ── 길찾기 ──────────────────────────────────────────────────────────────

/** 앱이면 카카오맵 앱(없으면 카카오맵 웹) 길찾기. 처리했으면 true, 브라우저면 false (링크 기본 동작에 맡김). */
export async function openDirectionsInApp(lat: number, lng: number, name: string): Promise<boolean> {
    if (!isApp()) return false;
    const r = await callNative("openDirections", { lat, lng, name });
    return r.ok;
}

// ── 로그인 ──────────────────────────────────────────────────────────────

let providersCache: Promise<SocialProvider[]> | null = null;

/** 앱이 지원하는 소셜 로그인 제공자 (앱 설정·플랫폼에 따라 다름). 브라우저면 빈 배열. */
export function getAppProviders(): Promise<SocialProvider[]> {
    if (!isApp()) return Promise.resolve([]);
    providersCache ??= callNative("getAppInfo", {}, 10_000)
        .then((r) => (Array.isArray(r.providers) ? (r.providers as SocialProvider[]) : []))
        .catch(() => {
            providersCache = null;
            return [];
        });
    return providersCache;
}

export interface NativeCredential {
    provider: SocialProvider;
    idToken?: string;
    accessToken?: string;
    authorizationCode?: string;
    displayName?: string;
}

export class NativeSignInCancelled extends Error {
    constructor() {
        super(i18n.t("login.cancelled"));
    }
}

/** 앱 SDK 로 소셜 로그인 → 서버에 보낼 자격 증명. */
export async function nativeSignIn(provider: SocialProvider, nonce: string): Promise<NativeCredential> {
    const r = await callNative("signIn", { provider, nonce });
    if (!r.ok) {
        if (r.reason === "cancelled") throw new NativeSignInCancelled();
        console.warn("[mashil] native signIn failed:", r.reason);
        throw new UserFacingError(i18n.t("login.nativeFailed"));
    }
    return {
        provider,
        idToken: r.idToken as string | undefined,
        accessToken: r.accessToken as string | undefined,
        authorizationCode: r.authorizationCode as string | undefined,
        displayName: r.displayName as string | undefined,
    };
}

export function nativeSignOut(provider: SocialProvider): Promise<BridgeReply> {
    return callNative("signOut", { provider }, 10_000).catch(() => ({ ok: false }));
}

export function appPlatform(): "android" | "ios" | null {
    const m = navigator.userAgent.match(/MashilApp\/\S+ \((android|ios)\)/);
    return m ? (m[1] as "android" | "ios") : null;
}
