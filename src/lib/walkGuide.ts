/**
 * 방향 안내 (직선): 내 위치에서 화장실까지 일직선과 남은 거리. 실제 길을 계산하지 않으므로
 * 걷는 거리와 시간은 직선 거리에 도심 우회 계수를 곱한 어림값이다.
 */
import { haversineMeters } from "../api";
import type { LatLng } from "../api";

/** 방향 안내 화면 주소 (화면 코드는 처음 열 때 받는다) */
export const walkGuidePath = (toiletId: number) => `/toilets/${toiletId}/guide`;

/** 홈·상세에서 넘겨 주는 값. 있으면 화장실 정보를 받기 전에도 지도를 바로 그린다 */
export interface WalkGuideState {
    name: string;
    lat: number;
    lng: number;
}

/** 직선 거리 → 실제로 걷는 거리 어림 (도심 길은 직선보다 대략 1.2~1.4배) */
export const DETOUR_FACTOR = 1.3;
/** 걷는 속도 (m/분). api.ts 의 computeStraightRoute 와 같은 4 km/h */
const WALK_M_PER_MIN = 4_000 / 60;

/** 이 거리 안이면 도착으로 본다 (m). 위치 오차가 크면 그만큼 넓힌다 (최대 ARRIVE_MAX_M) */
export const ARRIVE_M = 20;
const ARRIVE_MAX_M = 35;

/** 이보다 오차가 큰 위치는 지나온 길에 넣지 않는다 (실내·빌딩 사이에서 튀는 점) */
export const TRAIL_MAX_ACCURACY_M = 30;
/** 지나온 길은 이만큼 움직였을 때만 점을 더한다 */
const TRAIL_STEP_M = 5;
/** 지나온 길 점 수 상한 (오래 켜 두어도 선이 무거워지지 않게) */
const TRAIL_MAX_POINTS = 500;

/** 오차가 이보다 크면 "위치가 정확하지 않아요"를 함께 보여 준다 */
export const WEAK_ACCURACY_M = 50;

export interface GuideEstimate {
    /** 직선 거리 (m) */
    straightM: number;
    /** 걷는 시간 어림 (분, 최소 1) */
    minutes: number;
}

export function estimate(from: LatLng, to: LatLng): GuideEstimate {
    const straightM = haversineMeters(from, to);
    return { straightM, minutes: Math.max(1, Math.ceil((straightM * DETOUR_FACTOR) / WALK_M_PER_MIN)) };
}

export function hasArrived(straightM: number, accuracyM?: number): boolean {
    const radius = Math.min(ARRIVE_MAX_M, Math.max(ARRIVE_M, accuracyM ?? 0));
    return straightM <= radius;
}

/** 지나온 길에 새 위치를 더한 배열 (더할 필요가 없으면 같은 배열 그대로). */
export function appendTrail(trail: LatLng[], p: LatLng, accuracyM?: number): LatLng[] {
    if (accuracyM != null && accuracyM > TRAIL_MAX_ACCURACY_M) return trail;
    const last = trail.at(-1);
    if (last && haversineMeters(last, p) < TRAIL_STEP_M) return trail;
    const next = [...trail, p];
    return next.length > TRAIL_MAX_POINTS ? next.slice(next.length - TRAIL_MAX_POINTS) : next;
}

/** from 에서 to 를 보는 방위각 (도, 북쪽 0 시계방향). */
export function bearingDeg(from: LatLng, to: LatLng): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const φ1 = toRad(from.lat);
    const φ2 = toRad(to.lat);
    const Δλ = toRad(to.lng - from.lng);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** 8방위 이름 키 (i18n guide.dir.*). */
export type Direction8 = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
const DIRS: Direction8[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export function direction8(deg: number): Direction8 {
    return DIRS[Math.round(deg / 45) % 8];
}

// ── 실제 경로 (OpenStreetMap) ──────────────────────────────────────────────

/** 경로에서 이만큼 넘게 떨어진 위치가 OFF_ROUTE_FIXES 번 이어지면 다시 찾는다 */
export const OFF_ROUTE_M = 35;
export const OFF_ROUTE_FIXES = 3;
/** 다시 찾기 사이 최소 간격 (서버 요청 제한·배터리) */
export const REROUTE_MIN_INTERVAL_MS = 15_000;

export interface PathProjection {
    /** 경로까지의 거리 (m) */
    offM: number;
    /** 경로 시작에서 투영점까지 따라간 거리 (m) */
    alongM: number;
    /** 경로 전체 길이 (m) */
    totalM: number;
    /** 경로 위 가장 가까운 점 */
    point: LatLng;
}

/** 위치를 꺾은선 경로에 투영한다 (수 km 범위라 평면 근사). */
export function projectOnPath(p: LatLng, path: LatLng[]): PathProjection {
    const kx = Math.cos((p.lat * Math.PI) / 180) * 111_320;
    const ky = 110_574;
    const px = p.lng * kx;
    const py = p.lat * ky;
    let along = 0;
    let best: PathProjection = { offM: Infinity, alongM: 0, totalM: 0, point: path[0] };
    for (let i = 0; i + 1 < path.length; i++) {
        const ax = path[i].lng * kx, ay = path[i].lat * ky;
        const bx = path[i + 1].lng * kx, by = path[i + 1].lat * ky;
        const dx = bx - ax, dy = by - ay;
        const seg = Math.hypot(dx, dy);
        const t = seg === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / (seg * seg)));
        const qx = ax + t * dx, qy = ay + t * dy;
        const off = Math.hypot(px - qx, py - qy);
        if (off < best.offM) best = { offM: off, alongM: along + t * seg, totalM: 0, point: { lat: qy / ky, lng: qx / kx } };
        along += seg;
    }
    return { ...best, totalM: along };
}

/** 경로를 따라 남은 거리와 시간 어림. 시간은 서버 값(계단 반영)을 남은 비율만큼 */
export function remainingOnRoute(p: LatLng, path: LatLng[], routeMinutes: number): { remainingM: number; minutes: number; offM: number } {
    const proj = projectOnPath(p, path);
    const remainingM = Math.max(0, proj.totalM - proj.alongM) + proj.offM;
    const ratio = proj.totalM > 0 ? remainingM / proj.totalM : 1;
    return { remainingM, minutes: Math.max(1, Math.ceil(routeMinutes * ratio)), offM: proj.offM };
}
