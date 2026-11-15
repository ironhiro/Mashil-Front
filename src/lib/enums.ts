/**
 * 도메인 enum — 백엔드 enum 과 string 값을 맞춤 (DB 가 string 으로 저장).
 *
 * 형식 선택: TypeScript `enum` 대신 `as const` 객체 + `typeof[keyof typeof]` 유니언 타입.
 *  - 트리쉐이킹 친화적 (ts `enum` 은 런타임 객체)
 *  - 백엔드와 동일한 정확한 string 리터럴 ("Admin", "Pending", ...) 보존
 *  - import 한쪽만 쓰는 경우에도 IDE 자동완성/리팩터링 지원
 */

// --- Backend 와 string 값 일치 (DB 컬럼에 그대로 저장됨) ---

export const UserRole = {
    User: "User",
    Admin: "Admin",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ChangeRequestStatus = {
    Pending: "Pending",
    Approved: "Approved",
    Rejected: "Rejected",
} as const;
export type ChangeRequestStatus = (typeof ChangeRequestStatus)[keyof typeof ChangeRequestStatus];

export const ChangeRequestStatusOrder: ChangeRequestStatus[] = [
    ChangeRequestStatus.Pending,
    ChangeRequestStatus.Approved,
    ChangeRequestStatus.Rejected,
];

export const ChangeRequestKind = {
    Add: "Add",
    Update: "Update",
    Delete: "Delete",
} as const;
export type ChangeRequestKind = (typeof ChangeRequestKind)[keyof typeof ChangeRequestKind];

/** 제보 종류 순서. 라벨·설명은 번역 키 `report.kind.<값>.label|description`. */
export const CHANGE_REQUEST_KIND_OPTIONS: ChangeRequestKind[] = [
    ChangeRequestKind.Add,
    ChangeRequestKind.Update,
    ChangeRequestKind.Delete,
];

/** 화장실 종류 — 서버에 그대로 저장되는 값(한국어). 화면 표시는 번역 키 `toiletKind.<값>`. */
export const TOILET_KIND_OPTIONS = ["공중화장실", "개방화장실", "기타"] as const;

// --- Frontend 전용 (UI state) ---

export const FacilityFilter = {
    Men: "men",
    Women: "women",
    Accessible: "accessible",
    Child: "child",
} as const;
export type FacilityFilter = (typeof FacilityFilter)[keyof typeof FacilityFilter];

/** UI 토글 순서. 라벨은 번역 키 `facility.filter.<값>`. */
export const FACILITY_FILTER_OPTIONS: FacilityFilter[] = [
    FacilityFilter.Men,
    FacilityFilter.Women,
    FacilityFilter.Accessible,
    FacilityFilter.Child,
];

export const ViewMode = {
    Map: "map",
    List: "list",
    Recommended: "recommended",
} as const;
export type ViewMode = (typeof ViewMode)[keyof typeof ViewMode];

// --- 검색 반경 (UI state, 미터 단위) ---

export const SearchRadius = {
    R500m: 500,
    R1km: 1_000,
    R2km: 2_000,
    R3km: 3_000,
    R5km: 5_000,
    R10km: 10_000,
} as const;
export type SearchRadius = (typeof SearchRadius)[keyof typeof SearchRadius];

export const SEARCH_RADIUS_OPTIONS: { value: SearchRadius; label: string }[] = [
    { value: SearchRadius.R500m, label: "500 m" },
    { value: SearchRadius.R1km, label: "1 km" },
    { value: SearchRadius.R2km, label: "2 km" },
    { value: SearchRadius.R3km, label: "3 km" },
    { value: SearchRadius.R5km, label: "5 km" },
    { value: SearchRadius.R10km, label: "10 km" },
];

export const DEFAULT_SEARCH_RADIUS: SearchRadius = SearchRadius.R500m;
