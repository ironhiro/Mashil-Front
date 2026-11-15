import type { OpenStatus } from "../lib/openStatus";

/**
 * 영업 상태 → 4단계 (src/styles/app.css 의 .state--*). 색에만 의존하지 않도록 채움·테두리도 다르다.
 * - live:    파랑 채움 (지금 열림, 24시간 포함)
 * - soon:    빨강 채움 위 흰 글자 (30분 안에 닫힘 — 안내판의 "늦음" 행처럼)
 * - closed:  종이 + 2px 잉크 테두리
 * - unknown: 회색 종이 + 머리카락 선
 */
export type TileState = "live" | "soon" | "closed" | "unknown";

export function tileStateOf(status: OpenStatus): TileState {
    if (status.kind === "24h") return "live";
    if (status.kind === "open") return status.closingSoon ? "soon" : "live";
    if (status.kind === "closed") return "closed";
    return "unknown";
}

/** `className` 에 넣을 상태 클래스 */
export function stateClass(state: TileState): string {
    return `state state--${state}`;
}
