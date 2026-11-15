/**
 * 디자인 토큰 — 원본은 src/styles/tokens.css (Hallmark · Wayfind, OKLCH).
 *
 * 화면 코드는 CSS 변수(`var(--color-ink)`)를 직접 쓴다. 이 파일은 MUI 가 색을 계산(hover, 대비)하느라
 * CSS 변수나 oklch 를 읽지 못하는 자리에만 쓰는 hex 사본이다. tokens.css 를 바꾸면 여기도 맞춘다.
 */
export interface MuiMirror {
    paper: string;
    paper2: string;
    paper3: string;
    ink: string;
    ink2: string;
    muted: string;
    rule: string;
    accent: string;
    accent2: string;
    accentInk: string;
    error: string;
}

/** platform 색 (라이트) */
export const lightMirror: MuiMirror = {
    paper: "#dde5ed", // Pantone 656 C
    paper2: "#c5cfda", // 538 C
    paper3: "#ffffff",
    ink: "#041e42", // 282 C
    ink2: "#13294b", // 2767 C
    muted: "#425563", // 7545 C
    rule: "#bbc7d6", // 537 C
    accent: "#0033a0", // Pantone 286 C
    accent2: "#da291c", // Pantone 485 C
    accentInk: "#fcfeff",
    error: "#af272f", // 1805 C
};

/** night 색 (다크) */
export const darkMirror: MuiMirror = {
    paper: "#101820", // Pantone Black 6 C
    paper2: "#1d252d", // 433 C
    paper3: "#1d252d", // 433 C
    ink: "#dde5ed", // 656 C
    ink2: "#c5cfda", // 538 C
    muted: "#98a4ae", // 7543 C
    rule: "#333f48", // 432 C
    accent: "#485cc7", // 2726 C
    accent2: "#da291c",
    accentInk: "#fcfeff",
    error: "#f8485e", // 1785 C
};

/** CSS 변수 이름 — 화면 코드에서 `cssVar.ink` 처럼 쓴다 */
export const cssVar = {
    paper: "var(--color-paper)",
    paper2: "var(--color-paper-2)",
    paper3: "var(--color-paper-3)",
    ink: "var(--color-ink)",
    ink2: "var(--color-ink-2)",
    muted: "var(--color-muted)",
    rule: "var(--color-rule)",
    inkRule: "var(--color-ink-rule)",
    accent: "var(--color-accent)",
    accent2: "var(--color-accent-2)",
    accentInk: "var(--color-accent-ink)",
    error: "var(--color-error)",
    scrim: "var(--color-scrim)",
    ruleBar: "var(--rule-bar)",
    ruleHair: "var(--rule-hair)",
} as const;

export const fonts = {
    body: "var(--font-body)",
    display: "var(--font-display)",
} as const;
