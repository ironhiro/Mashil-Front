/** 마실 백엔드(Mashil.Api)에 대한 typed fetch 헬퍼. */

import { readAuthToken, refreshAccessToken } from "./auth/AuthContext";
import type { ChangeRequestKind, ChangeRequestStatus } from "./lib/enums";
import { USE_MOCK } from "./mock/flag";

/** 서버가 KST·요일·공휴일·자정 넘김을 반영해 판정한 영업 상태 (docs/API.md). */
export interface ServerOpenStatus {
    kind: "AlwaysOpen" | "Open" | "Closed" | "Unknown";
    closesAt: string | null;
    nextOpen: { daysFromToday: number; day: Weekday; at: string } | null;
    /** 한국어 문구 — 화면에는 번역 키로 다시 만든다 */
    label: string;
}

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type ScheduleDay = Weekday | "Holiday";

export interface ToiletNear {
    id: number;
    name: string;
    kind: string;
    roadAddress: string | null;
    lotAddress: string | null;
    latitude: number | null;
    longitude: number | null;
    distanceM: number;

    maleStallCount: number;
    maleUrinalCount: number;
    maleAccessibleStallCount: number;
    maleAccessibleUrinalCount: number;
    maleChildStallCount: number;
    maleChildUrinalCount: number;
    femaleStallCount: number;
    femaleAccessibleStallCount: number;
    femaleChildStallCount: number;

    openHours: string | null;
    openHoursDetail: string | null;
    phone: string | null;

    /** 평점 행이 0개면 null. */
    averageRating: number | null;
    /** 평균을 낸 평점 수 */
    ratingCount: number;
    /** Hidden 제외 댓글 수. */
    commentCount: number;

    /** Public / Open / Temporary / Mobile / Other (목업에는 없음) */
    kindCode?: string;
    scheduleStatus?: string;
    /** 서버 판정 (목업에는 없음 → 원문 정규식 판정으로 대체) */
    openStatus?: ServerOpenStatus;
}

const BASE = ""; // dev: vite proxy가 /api → :5099 로 프록시

interface FetchOptions {
    method?: string;
    body?: unknown;
    auth?: boolean;
    /** 응답 헤더가 필요할 때 (예: 검색 전체 수 X-Total-Count) */
    onHeaders?: (headers: Headers) => void;
}

/** 공통 fetch — auth=true 면 localStorage 의 JWT 를 Authorization 헤더로 자동 붙임. */
async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const { method = "GET", body, auth = false, onHeaders } = options;
    if (USE_MOCK) {
        const { mockFetch } = await import("./mock/mockApi");
        return mockFetch<T>(path, method, body);
    }
    const send = (token: string | null) => {
        const headers: Record<string, string> = {};
        if (body !== undefined) headers["Content-Type"] = "application/json";
        if (auth && token) headers["Authorization"] = `Bearer ${token}`;
        return fetch(`${BASE}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    };
    const sent = auth ? readAuthToken() : null;
    let res = await send(sent);
    // 액세스 토큰이 만료됐으면 한 번 갱신하고 다시 보낸다 (갱신도 거절되면 로그아웃 상태가 되고 401 그대로)
    if (res.status === 401 && sent && readAuthToken()) {
        const fresh = await refreshAccessToken(sent);
        if (fresh) res = await send(fresh);
    }
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
    }
    onHeaders?.(res.headers);
    if (res.status === 204) return undefined as T;
    return res.json();
}

/** 단건 화장실 상세 — 변경 요청(수정/삭제) 작성 시 prefill 용. */
export interface ToiletDetail {
    id: number;
    managementNo: string;
    name: string;
    kind: string;
    roadAddress: string | null;
    lotAddress: string | null;
    latitude: number | null;
    longitude: number | null;
    openHours: string | null;
    openHoursDetail: string | null;
    phone: string | null;

    kindCode?: string;
    status?: "Active" | "Missing" | "Removed";
    scheduleStatus?: string;
    openStatus?: ServerOpenStatus;
    /** 요일별 개방 시간. 같은 요일에 여러 칸 가능 (점심 분할) */
    schedules?: { day: ScheduleDay; open: string | null; close: string | null; closed: boolean }[];
    facilities?: {
        maleStall: number;
        maleUrinal: number;
        maleAccessibleStall: number;
        maleAccessibleUrinal: number;
        maleChildStall: number;
        maleChildUrinal: number;
        femaleStall: number;
        femaleAccessibleStall: number;
        femaleChildStall: number;
        emergencyBell: boolean | null;
        entranceCctv: boolean | null;
        diaperChanger: boolean | null;
    };
    source?: {
        provider: string;
        dataReferenceDate: string | null;
        coordinateSource: string | null;
        editedByPeople: boolean;
        /** 원본을 마지막으로 받아 반영·확인한 시각 (ISO, UTC). 임포트 기록이 없으면 null */
        lastRefreshedAt?: string | null;
    };
    /** 평점 평균 (평점이 없으면 null)과 평점 수 */
    averageRating?: number | null;
    ratingCount?: number;
}

export function fetchToilet(id: number): Promise<ToiletDetail> {
    return apiFetch<ToiletDetail>(`/api/toilets/${id}`);
}

export async function fetchNearbyToilets(
    lat: number,
    lng: number,
    radiusM: number,
    limit = 2000,
): Promise<ToiletNear[]> {
    const qs = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radiusM: String(radiusM),
        limit: String(limit),
    });
    return apiFetch<ToiletNear[]>(`/api/toilets/near?${qs}`);
}

export async function postRating(toiletId: number, score: number): Promise<void> {
    return apiFetch<void>(`/api/toilets/${toiletId}/ratings`, {
        method: "POST",
        body: { score },
        auth: true,
    });
}

export interface CommentRow {
    id: number;
    userId: string;
    toiletId: number;
    /** 표시 이름. 탈퇴한 작성자는 서버가 "탈퇴한 사용자"로 준다 (목업에는 없음) */
    authorName?: string;
    authorDeleted?: boolean;
    text: string;
    hidden: boolean;
    createdAt: string;
    updatedAt: string;
    /** 토큰을 보냈을 때만 의미 있음 */
    isMine?: boolean;
    /** 도움돼요 / 아니에요 수 */
    upCount?: number;
    downCount?: number;
    /** 내 표: 1 도움돼요, -1 아니에요, 0 없음 */
    myVote?: number;
}

export function fetchComments(toiletId: number): Promise<CommentRow[]> {
    // 토큰을 보내면 내 댓글 표시(isMine)와 내 표(myVote)가 온다. 없으면 공개 목록
    return apiFetch<CommentRow[]>(`/api/toilets/${toiletId}/comments`, { auth: true });
}

export interface VoteResult {
    upCount: number;
    downCount: number;
    myVote: number;
}

/** 댓글 도움돼요(1) / 아니에요(-1) / 취소(0). 자기 댓글은 400 */
export function voteComment(commentId: number, value: 1 | -1 | 0): Promise<VoteResult> {
    return apiFetch<VoteResult>(`/api/comments/${commentId}/vote`, { method: "PUT", body: { value }, auth: true });
}

/** 추천 한 건: 근처 목록과 같은 화장실 + 점수와 근거 */
export interface RecommendedToilet {
    toilet: ToiletNear;
    score: number;
    ratingCount: number;
    helpfulUp: number;
    helpfulDown: number;
}

/** 지금 여기서 가기 좋은 곳 (닫힌 곳 제외, 평점이나 댓글 평가가 있는 곳만, 점수순) */
/** 이름·주소 검색 결과 (MAP-06). 좌표가 아직 없는 곳도 나온다 */
export interface ToiletSearchResult {
    id: number;
    name: string;
    roadAddress: string | null;
    lotAddress: string | null;
    latitude: number | null;
    longitude: number | null;
}

/** 검색 한 번에 받는 수. 더 있으면 "더 보기" 로 이어 받는다 */
export const SEARCH_PAGE = 30;

export interface ToiletSearchPage {
    items: ToiletSearchResult[];
    /** 맞는 곳 전체 수 (서버 X-Total-Count). 헤더가 없으면 지금까지 받은 수로 본다 */
    total: number;
}

/** near 를 주면 서버가 그 근처부터 고른다. offset 부터 SEARCH_PAGE 건 */
export async function searchToilets(q: string, near: LatLng | null, offset = 0): Promise<ToiletSearchPage> {
    const at = near ? `&lat=${near.lat}&lng=${near.lng}` : "";
    let total: number | null = null;
    const items = await apiFetch<ToiletSearchResult[]>(
        `/api/toilets/search?q=${encodeURIComponent(q)}&limit=${SEARCH_PAGE}&offset=${offset}${at}`,
        {
            onHeaders: (h) => {
                const n = Number(h.get("X-Total-Count"));
                if (h.has("X-Total-Count") && Number.isFinite(n)) total = n;
            },
        },
    );
    return { items, total: total ?? offset + items.length };
}

export function fetchRecommendedToilets(lat: number, lng: number, radiusM: number, limit = 5): Promise<RecommendedToilet[]> {
    return apiFetch<RecommendedToilet[]>(
        `/api/toilets/recommended?lat=${lat}&lng=${lng}&radiusM=${radiusM}&limit=${limit}`,
    );
}

export function postComment(toiletId: number, text: string): Promise<CommentRow> {
    return apiFetch<CommentRow>(`/api/toilets/${toiletId}/comments`, {
        method: "POST",
        body: { text },
        auth: true,
    });
}

// --- 길찾기 (직선 거리 + 도보 4km/h 추정) ---
// Kakao Mobility 보행 라우팅으로 갈아끼울 때는 path 배열만 실제 polyline 으로 교체.

export interface LatLng {
    lat: number;
    lng: number;
}

export interface RouteEstimate {
    distanceM: number;
    walkingMinutes: number;
    path: LatLng[];
    isStraightLine: true;
}

const WALKING_SPEED_M_PER_MIN = 4_000 / 60; // 4 km/h ≈ 67 m/min
const EARTH_RADIUS_M = 6_371_000;

export function computeStraightRoute(from: LatLng, to: LatLng): RouteEstimate {
    const distanceM = haversineMeters(from, to);
    const walkingMinutes = Math.max(1, Math.ceil(distanceM / WALKING_SPEED_M_PER_MIN));
    return { distanceM, walkingMinutes, path: [from, to], isStraightLine: true };
}

export function haversineMeters(a: LatLng, b: LatLng): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(x));
}

// --- Admin: change requests ---

export interface ChangeRequestRow {
    id: number;
    requesterId: string;
    targetToiletId: number | null;
    kind: string;
    payloadJson: string;
    status: ChangeRequestStatus;
    reviewedById: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
    createdAt: string;
}

export async function fetchChangeRequests(status?: ChangeRequestStatus): Promise<ChangeRequestRow[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch<ChangeRequestRow[]>(`/api/admin/change-requests${qs}`, { auth: true });
}

export async function reviewChangeRequest(
    id: number,
    approve: boolean,
    note?: string,
): Promise<void> {
    return apiFetch<void>(`/api/admin/change-requests/${id}`, {
        method: "PATCH",
        body: { approve, note },
        auth: true,
    });
}

export interface SubmitChangeRequestPayload {
    kind: ChangeRequestKind;
    targetToiletId: number | null;
    payloadJson: string | null;
}

export async function submitChangeRequest(payload: SubmitChangeRequestPayload): Promise<ChangeRequestRow> {
    return apiFetch<ChangeRequestRow>(`/api/change-requests`, {
        method: "POST",
        body: payload,
        auth: true,
    });
}

// --- 내 활동 (GET /api/me/comments, /api/me/change-requests) ---

/** 내가 쓴 댓글. 신고로 가려졌으면 hidden. 화장실이 지워졌으면 toiletName = null. */
export interface MyComment {
    id: number;
    toiletId: number;
    toiletName: string | null;
    text: string;
    hidden: boolean;
    createdAt: string;
    updatedAt: string;
}

/** 내가 보낸 제보와 진행 상황. toiletName 은 대상 이름, 추가 요청이면 제보에 적은 이름. */
export interface MyChangeRequest {
    id: number;
    kind: ChangeRequestKind;
    status: ChangeRequestStatus;
    targetToiletId: number | null;
    toiletName: string | null;
    createdAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
}

export function fetchMyComments(): Promise<MyComment[]> {
    return apiFetch<MyComment[]>("/api/me/comments", { auth: true });
}

export function fetchMyChangeRequests(): Promise<MyChangeRequest[]> {
    return apiFetch<MyChangeRequest[]>("/api/me/change-requests", { auth: true });
}

// ── 점검 모드 (GET /api/app/status) ─────────────────────────────────────

export interface AppStatus {
    maintenance: boolean;
    readOnly: boolean;
    message: string | null;
    until: string | null;
}

/** 서버에 점검 상태 API 가 없거나(404) 실패하면 null — 정상 운영으로 본다. */
export async function fetchAppStatus(): Promise<AppStatus | null> {
    if (USE_MOCK) return null;
    try {
        const res = await fetch(`${BASE}/api/app/status`, { cache: "no-store" });
        return res.ok ? ((await res.json()) as AppStatus) : null;
    } catch {
        return null;
    }
}

// ── 약관 동의 (docs/API.md Auth) ────────────────────────────────────────

export type ConsentDocType = "Terms" | "Privacy" | "LocationTerms";

export interface ConsentStatus {
    required: boolean;
    documents: { docType: ConsentDocType; version: string; agreed: boolean }[];
}

export function fetchConsents(): Promise<ConsentStatus> {
    return apiFetch<ConsentStatus>("/api/auth/consents", { auth: true });
}

/** 현재 버전에만 동의할 수 있다. 다른 버전이면 409 consent_version_mismatch. */
export function postConsents(items: { docType: ConsentDocType; version: string }[]): Promise<void> {
    return apiFetch<void>("/api/auth/consents", { method: "POST", body: { items }, auth: true });
}

/** 표시 이름 변경 (최대 20자). */
export function updateDisplayName(displayName: string): Promise<void> {
    return apiFetch<void>("/api/auth/me", { method: "PATCH", body: { displayName }, auth: true });
}
