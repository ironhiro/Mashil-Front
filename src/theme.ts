import { createTheme } from "@mui/material/styles";
import { darkMirror, lightMirror } from "./design/tokens";
import type { MuiMirror } from "./design/tokens";

/**
 * MUI 테마 — Hallmark · Wayfind (src/styles/app.css 의 스탬프).
 * 정사각(모서리 0), 2px 잉크 테두리, 파랑(286 C)은 지금 열림과 주 행동에만, 선택은 잉크 칸.
 * 색은 CSS 변수(tokens.css)를 쓰고, MUI 가 계산해야 하는 자리만 hex 사본(design/tokens.ts).
 */
function palette(m: MuiMirror) {
    return {
        primary: { main: m.accent, contrastText: m.accentInk },
        secondary: { main: m.ink, contrastText: m.paper },
        error: { main: m.error, contrastText: m.accentInk },
        background: { default: m.paper, paper: m.paper3 },
        text: { primary: m.ink, secondary: m.muted },
        divider: m.rule,
    };
}

const bar = "var(--rule-bar) solid var(--color-ink)";

export const theme = createTheme({
    cssVariables: { colorSchemeSelector: "media" },
    colorSchemes: {
        light: { palette: palette(lightMirror) },
        dark: { palette: palette(darkMirror) },
    },
    typography: {
        fontFamily: "var(--font-body)",
        fontWeightBold: 800,
        // 가로 폰처럼 화면이 낮으면 큰 제목이 한 화면을 다 먹지 않게 한 단계 줄인다
        h4: {
            fontWeight: 800,
            fontSize: "var(--text-3xl)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: 1.05,
            "@media (max-height: 30rem)": { fontSize: "var(--text-2xl)" },
        },
        h5: { fontWeight: 800, fontSize: "var(--text-2xl)", letterSpacing: "var(--tracking-display)", lineHeight: 1.05 },
        h6: { fontWeight: 800, fontSize: "var(--text-xl)", lineHeight: 1.1 },
        subtitle1: { fontWeight: 800 },
        subtitle2: { fontWeight: 800 },
        button: { textTransform: "none", fontWeight: 800 },
        body1: { fontSize: "var(--text-md)", lineHeight: 1.55 },
        body2: { fontSize: "var(--text-sm)", lineHeight: 1.5 },
        caption: { fontSize: "var(--text-xs)", fontWeight: 500 },
    },
    shape: { borderRadius: 0 },
    shadows: Array(25).fill("none") as never, // 깊이는 테두리로
    components: {
        MuiAppBar: {
            defaultProps: { elevation: 0, color: "inherit" },
            styleOverrides: {
                root: { backgroundColor: "var(--color-paper)", color: "var(--color-ink)", borderBottom: bar },
            },
        },
        MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: "none" } } },
        MuiCard: {
            defaultProps: { variant: "outlined" },
            styleOverrides: { root: { border: bar, backgroundColor: "var(--color-paper-3)" } },
        },
        MuiButton: {
            defaultProps: { disableElevation: true, disableRipple: true },
            styleOverrides: {
                root: {
                    borderRadius: 0,
                    minHeight: 44,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    transition: "background-color var(--dur-micro) steps(1), color var(--dur-micro) steps(1)",
                    "&:focus-visible": { outline: "2px solid var(--color-focus)", outlineOffset: 2 },
                    "&:active": { transform: "translateY(1px)" },
                    "&.Mui-disabled": { opacity: 0.55, cursor: "not-allowed" },
                },
                sizeLarge: { minHeight: 52 },
                contained: { border: "var(--rule-bar) solid transparent" },
                outlined: {
                    border: bar,
                    color: "var(--color-ink)",
                    "&:hover": { border: bar, backgroundColor: "var(--color-paper-2)" },
                },
                text: { textDecoration: "underline", textUnderlineOffset: "0.2em", "&:hover": { backgroundColor: "transparent", color: "var(--color-accent-text)" } },
                // 글자로 쓰는 파랑은 밤에 밝힌 값 (면으로 쓰는 --color-accent 는 밤 바탕 위 글자로 대비가 모자람)
                textPrimary: { color: "var(--color-accent-text)" },
            },
        },
        MuiIconButton: {
            defaultProps: { disableRipple: true },
            styleOverrides: { root: { borderRadius: 0, "&:focus-visible": { outline: "2px solid var(--color-focus)", outlineOffset: 2 } } },
        },
        MuiButtonBase: { defaultProps: { disableRipple: true } },
        MuiToggleButtonGroup: {
            styleOverrides: {
                // 칸들이 2px 테두리를 공유
                root: { borderRadius: 0, gap: 0 },
                grouped: { "&:not(:first-of-type)": { marginLeft: "calc(var(--rule-bar) * -1)", borderLeft: bar } },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                root: {
                    borderRadius: 0,
                    border: bar,
                    minHeight: 44,
                    textTransform: "none",
                    fontWeight: 500,
                    color: "var(--color-ink)",
                    backgroundColor: "var(--color-paper-3)",
                    "&:hover": { backgroundColor: "var(--color-paper-2)" },
                    "&.Mui-selected, &.Mui-selected:hover": { backgroundColor: "var(--color-ink)", color: "var(--color-paper)", fontWeight: 800 },
                    "&:focus-visible": { outline: "2px solid var(--color-focus)", outlineOffset: 2, zIndex: 1 },
                },
            },
        },
        MuiChip: {
            styleOverrides: { root: { borderRadius: 0, fontWeight: 500 }, outlined: { border: bar } },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 0,
                    backgroundColor: "var(--color-paper-3)",
                    "& .MuiOutlinedInput-notchedOutline": { border: bar },
                    "&:hover .MuiOutlinedInput-notchedOutline": { border: bar },
                    // 포커스는 테두리 두께가 아니라 색 (39a). 바깥 outline 은 떠 있는 라벨("표시 이름")을 가로질러 그어져서
                    // 라벨 자리를 비워 두는 테두리(notched outline)의 색을 바꾼다
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { border: "var(--rule-bar) solid var(--color-focus)" },
                    // 필수 칸을 비우고 보냈을 때: 포커스가 있어도 테두리는 오류 색 (라벨·안내 글자와 같은 색)
                    "&.Mui-error .MuiOutlinedInput-notchedOutline, &.Mui-error.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        border: "var(--rule-bar) solid var(--color-error)",
                    },
                },
            },
        },
        MuiInputLabel: { styleOverrides: { root: { fontWeight: 500, color: "var(--color-ink-2)" } } },
        MuiAlert: {
            styleOverrides: {
                root: { borderRadius: 0, border: bar, alignItems: "center" },
                standardInfo: { backgroundColor: "var(--color-paper-2)", color: "var(--color-ink)", "& .MuiAlert-icon": { color: "var(--color-ink)" } },
                standardSuccess: { backgroundColor: "var(--color-paper-3)", color: "var(--color-ink)", "& .MuiAlert-icon": { color: "var(--color-accent)" } },
                standardError: { backgroundColor: "var(--color-paper-3)", color: "var(--color-error)", borderColor: "var(--color-error)", "& .MuiAlert-icon": { color: "var(--color-error)" } },
                standardWarning: { backgroundColor: "var(--color-soon)", color: "var(--color-soon-ink)", "& .MuiAlert-icon": { color: "var(--color-soon-ink)" } },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: { backgroundColor: "var(--color-paper)", borderRight: bar },
                paperAnchorBottom: { borderRight: 0, borderTop: bar },
            },
        },
        MuiBackdrop: { styleOverrides: { root: { backgroundColor: "var(--color-scrim)" } } },
        MuiRating: { styleOverrides: { iconFilled: { color: "var(--color-accent)" }, iconEmpty: { color: "var(--color-muted)" } } },
        MuiCheckbox: { styleOverrides: { root: { color: "var(--color-ink)", "&.Mui-checked": { color: "var(--color-accent)" } } } },
        MuiLink: { styleOverrides: { root: { color: "var(--color-ink)", textUnderlineOffset: "0.2em", "&:hover": { color: "var(--color-accent-text)" } } } },
        MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 500, "&.Mui-selected": { fontWeight: 800, color: "var(--color-ink)" } } } },
        MuiTabs: { styleOverrides: { indicator: { height: 3, backgroundColor: "var(--color-ink)" } } },
        MuiTableCell: {
            styleOverrides: {
                head: { fontWeight: 500, color: "var(--color-muted)", borderBottom: bar },
                root: { borderBottom: "var(--rule-hair) solid var(--color-rule)" },
            },
        },
        MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 0, backgroundColor: "var(--color-ink)", color: "var(--color-paper)", fontWeight: 500 } } },
        MuiSnackbarContent: { styleOverrides: { root: { borderRadius: 0, backgroundColor: "var(--color-ink)", color: "var(--color-paper)" } } },
    },
});
