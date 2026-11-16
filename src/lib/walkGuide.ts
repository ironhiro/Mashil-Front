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
