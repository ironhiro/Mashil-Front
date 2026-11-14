/** `npm run dev:mock` (.env.mock → VITE_USE_MOCK=true) 일 때만 true. 백엔드 없이 데모 화면을 띄울 때 사용. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

/** 목업 모드의 가짜 "내 위치" (광화문) — 목업 데이터가 이 주변 3km 에 있음. */
export const MOCK_USER_LOCATION = { lat: 37.5714, lng: 126.9768 };
