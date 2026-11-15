import type { ToiletNear } from "../api";
import { FacilityFilter } from "./enums";
import { statusOf } from "./openStatus";

/** 필터 시트의 개방 상태 세그먼트 */
export type OpenFilter = "all" | "open" | "always";

/** 구분 칩 (선택 안 하면 전체) — 서버 kindCode 묶음 */
export type KindFilter = "Public" | "Open" | "Other";
export const KIND_FILTER_OPTIONS: KindFilter[] = ["Public", "Open", "Other"];

/** 시설 2×2 타일 (남·여·장애인·어린이) */
export const FACILITY_TILE_OPTIONS = [
    FacilityFilter.Men,
    FacilityFilter.Women,
    FacilityFilter.Accessible,
    FacilityFilter.Child,
] as const;

export interface ToiletFilter {
    open: OpenFilter;
    facilities: FacilityFilter[];
    kinds: KindFilter[];
}

export const EMPTY_FILTER: ToiletFilter = { open: "all", facilities: [], kinds: [] };

/** 걸려 있는 조건 수 (필터 버튼 배지) */
export function activeFilterCount(f: ToiletFilter): number {
    return (f.open !== "all" ? 1 : 0) + f.facilities.length + f.kinds.length;
}

export function applyFilter(toilets: ToiletNear[], f: ToiletFilter, now: Date = new Date()): ToiletNear[] {
    return toilets.filter((t) => {
        if (f.open !== "all") {
            const kind = statusOf(t, now).kind;
            if (f.open === "always" && kind !== "24h") return false;
            if (f.open === "open" && kind !== "24h" && kind !== "open") return false;
        }
        for (const fac of f.facilities) if (!facilityMatch(t, fac)) return false;
        if (f.kinds.length > 0 && !f.kinds.includes(kindGroup(t))) return false;
        return true;
    });
}

/** kindCode (Public / Open / Temporary / Mobile / Other) → 구분 칩. 목업처럼 코드가 없으면 한국어 이름으로. */
function kindGroup(t: ToiletNear): KindFilter {
    const code = t.kindCode ?? (t.kind === "공중화장실" ? "Public" : t.kind === "개방화장실" ? "Open" : "Other");
    return code === "Public" || code === "Open" ? code : "Other";
}

export function facilityMatch(t: ToiletNear, key: FacilityFilter): boolean {
    switch (key) {
        case FacilityFilter.Men:
            return t.maleStallCount + t.maleUrinalCount > 0;
        case FacilityFilter.Women:
            return t.femaleStallCount > 0;
        case FacilityFilter.Accessible:
            return t.maleAccessibleStallCount + t.maleAccessibleUrinalCount + t.femaleAccessibleStallCount > 0;
        case FacilityFilter.Child:
            return t.maleChildStallCount + t.maleChildUrinalCount + t.femaleChildStallCount > 0;
    }
}
