/**
 * 마실 디자인 토큰 — docs/07-ui-design.md (Mashil-App 저장소) "C. 타일" 방향.
 *
 * 원칙 요약
 * - 청록 한 색조를 밝기만 달리해서 쓴다. 두 번째 강조색 없음.
 * - 청록(accent)은 "지금 열림"과 화면당 주 행동 버튼 1개에만. 선택 상태는 무채색(selected).
 * - 상태는 색에만 의존하지 않는다: 채움 / 진한 채움 / 점선 테두리 / 회색 테두리.
 * - danger 는 되돌릴 수 없는 행동(계정 삭제)에만.
 */
export interface MashilTokens {
    bg: string;
    surface: string;
    surfaceSunken: string;
    line: string;
    text: string;
    textMuted: string;
    accent: string;
    onAccent: string;
    accentSoft: string;
    onAccentSoft: string;
    selected: string;
    onSelected: string;
    closedBorder: string;
    closedText: string;
    danger: string;
    onDanger: string;
    scrim: string;
    /** 지도 위 길 (타일 사이 줄) */
    mapRoad: string;
}

export const lightTokens: MashilTokens = {
    bg: "#E8F2F0",
    surface: "#FFFFFF",
    surfaceSunken: "#D7E8E5",
    line: "#C3DCD8",
    text: "#0E3B3A",
    textMuted: "#2F6F6B",
    accent: "#1F6F69",
    onAccent: "#FFFFFF",
    accentSoft: "#CFE3E0",
    onAccentSoft: "#0E3B3A",
    selected: "#0E3B3A",
    onSelected: "#FFFFFF",
    closedBorder: "#6FA39E",
    closedText: "#2F6F6B",
    danger: "#A2352B",
    onDanger: "#FFFFFF",
    scrim: "rgba(14,59,58,0.45)",
    mapRoad: "#F4F9F8",
};

export const darkTokens: MashilTokens = {
    bg: "#111213",
    surface: "#1B1C1E",
    surfaceSunken: "#161718",
    line: "#2A2C2F",
    text: "#ECECEC",
    textMuted: "#9A9DA3",
    accent: "#5CC2B7",
    onAccent: "#0B1F1D",
    accentSoft: "#23403D",
    onAccentSoft: "#D9F0EC",
    selected: "#ECECEC",
    onSelected: "#111213",
    closedBorder: "#4F7F7A",
    closedText: "#9FC9C3",
    // 문서에서 다크 danger 는 미정 — 라이트 값을 밝혀 대비만 맞춤 (확정 시 교체)
    danger: "#E07A6F",
    onDanger: "#1B0B09",
    scrim: "rgba(0,0,0,0.6)",
    mapRoad: "#26282B",
};

export const fonts = {
    body: "'IBM Plex Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    logo: "'Gowun Dodum', 'IBM Plex Sans KR', sans-serif",
    /** 거리 숫자, 시각 — 자릿수 고정 폭 */
    mono: "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export const radius = {
    base: 6,
    sheet: 14,
} as const;

/** 줄눈 격자 (32px 간격, 1px). background-image 로 쓴다. */
export function tileGrid(lineColor: string, gap = 32): string {
    return `repeating-linear-gradient(0deg, ${lineColor} 0 1px, transparent 1px ${gap}px), repeating-linear-gradient(90deg, ${lineColor} 0 1px, transparent 1px ${gap}px)`;
}
