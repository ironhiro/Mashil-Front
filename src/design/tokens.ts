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
    paper: "#edf0f4",
    paper2: "#dde2e7",
    paper3: "#fbfeff",
    ink: "#0a0d13",
    ink2: "#282b32",
    muted: "#565b64",
    rule: "#b9bec5",
    accent: "#2055e1",
    accent2: "#f4b522",
    accentInk: "#fcfeff",
    error: "#be2323",
};

/** night 색 (다크) */
export const darkMirror: MuiMirror = {
    paper: "#080b10",
    paper2: "#13161c",
    paper3: "#0f1217",
    ink: "#eff2f5",
    ink2: "#cdd1d6",
    muted: "#a0a5ac",
    rule: "#2c3038",
    accent: "#457cfd",
    accent2: "#f4b522",
    accentInk: "#fcfeff",
    error: "#ef675c",
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
