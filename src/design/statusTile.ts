import type { Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";
import type { OpenStatus } from "../lib/openStatus";

/**
 * 영업 상태 → 타일 4단계 (docs/07-ui-design.md §3). 색에만 의존하지 않도록 채움·테두리 모양도 다르다.
 * - open:     accent 채움 (24시간 포함)
 * - soon:     accent-soft 채움 (30분 안에 닫힘)
 * - closed:   surface + 점선 테두리
 * - unknown:  surface-sunken + 회색 실선
 */
export type TileState = "open" | "soon" | "closed" | "unknown";

export function tileStateOf(status: OpenStatus): TileState {
    if (status.kind === "24h") return "open";
    if (status.kind === "open") return status.closingSoon ? "soon" : "open";
    if (status.kind === "closed") return "closed";
    return "unknown";
}

/** 타일·칩 공통 배경/글자/테두리. border 두께가 상태마다 달라 레이아웃이 흔들리지 않게 모두 1.5px. */
export function tileSx(state: TileState): SystemStyleObject<Theme> {
    switch (state) {
        case "open":
            return { bgcolor: "mashil.accent", color: "mashil.onAccent", border: "1.5px solid", borderColor: "mashil.accent" };
        case "soon":
            return { bgcolor: "mashil.accentSoft", color: "mashil.onAccentSoft", border: "1.5px solid", borderColor: "mashil.accentSoft" };
        case "closed":
            return { bgcolor: "mashil.surface", color: "mashil.closedText", border: "1.5px dashed", borderColor: "mashil.closedBorder" };
        default:
            return { bgcolor: "mashil.surfaceSunken", color: "mashil.textMuted", border: "1.5px solid", borderColor: "mashil.line" };
    }
}

/** 지도 마커처럼 MUI 밖(DOM 직접)에서 쓰는 같은 스타일 — CSS 변수 이름으로. */
export function tileCss(state: TileState): string {
    const v = (name: string) => `var(--mui-palette-mashil-${name})`;
    switch (state) {
        case "open":
            return `background:${v("accent")};color:${v("onAccent")};border:1.5px solid ${v("accent")};`;
        case "soon":
            return `background:${v("accentSoft")};color:${v("onAccentSoft")};border:1.5px solid ${v("accentSoft")};`;
        case "closed":
            return `background:${v("surface")};color:${v("closedText")};border:1.5px dashed ${v("closedBorder")};`;
        default:
            return `background:${v("surfaceSunken")};color:${v("textMuted")};border:1.5px solid ${v("line")};`;
    }
}
