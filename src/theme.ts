import { createTheme } from "@mui/material/styles";
import { darkTokens, fonts, lightTokens, radius } from "./design/tokens";
import type { MashilTokens } from "./design/tokens";

/**
 * 마실 테마 — 디자인 토큰(src/design/tokens.ts)을 MUI 에 연결.
 * 라이트·다크는 기기 설정(prefers-color-scheme)을 따른다. 색은 CSS 변수라 sx 에서
 * "mashil.accent" 같은 팔레트 경로나 theme.vars.palette.mashil.* 로 쓴다.
 */
declare module "@mui/material/styles" {
    interface Palette {
        mashil: MashilTokens;
    }
    interface PaletteOptions {
        mashil?: MashilTokens;
    }
}

function palette(t: MashilTokens) {
    return {
        primary: { main: t.accent, contrastText: t.onAccent },
        // 보조 강조색은 두지 않는다 — secondary 는 무채색(선택 상태와 같은 먹색)
        secondary: { main: t.selected, contrastText: t.onSelected },
        error: { main: t.danger, contrastText: t.onDanger },
        background: { default: t.bg, paper: t.surface },
        text: { primary: t.text, secondary: t.textMuted },
        divider: t.line,
        mashil: t,
    };
}

export const theme = createTheme({
    cssVariables: { colorSchemeSelector: "media" },
    colorSchemes: {
        light: { palette: palette(lightTokens) },
        dark: { palette: palette(darkTokens) },
    },
    typography: {
        fontFamily: fonts.body,
        h4: { fontWeight: 700, fontSize: "1.6rem", letterSpacing: "-0.01em" },
        h5: { fontWeight: 700 },
        h6: { fontWeight: 700 },
        subtitle1: { fontWeight: 700 },
        button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: radius.base },
    shadows: Array(25).fill("none") as never, // 부드러운 큰 그림자는 쓰지 않는다
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: { fontFeatureSettings: '"tnum"' },
            },
        },
        MuiAppBar: {
            defaultProps: { elevation: 0, color: "inherit" },
            styleOverrides: {
                root: ({ theme }) => ({
                    backgroundColor: theme.vars!.palette.mashil.surface,
                    color: theme.vars!.palette.mashil.text,
                    borderBottom: `1px solid ${theme.vars!.palette.mashil.line}`,
                }),
            },
        },
        MuiPaper: {
            defaultProps: { elevation: 0 },
        },
        MuiCard: {
            defaultProps: { variant: "outlined" },
        },
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: { borderRadius: radius.base, minHeight: 40 },
                sizeLarge: { minHeight: 52 },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                root: ({ theme }) => ({
                    textTransform: "none",
                    fontWeight: 600,
                    minHeight: 36,
                    color: theme.vars!.palette.mashil.text,
                    backgroundColor: theme.vars!.palette.mashil.bg,
                    borderColor: theme.vars!.palette.mashil.line,
                    // 선택 상태는 무채색 — 청록은 "열림"과 주 행동에만
                    "&.Mui-selected, &.Mui-selected:hover": {
                        backgroundColor: theme.vars!.palette.mashil.selected,
                        color: theme.vars!.palette.mashil.onSelected,
                    },
                }),
            },
        },
        MuiChip: {
            styleOverrides: {
                root: { borderRadius: radius.base, fontWeight: 600 },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: ({ theme }) => ({
                    backgroundColor: theme.vars!.palette.mashil.surface,
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: theme.vars!.palette.mashil.line },
                }),
            },
        },
        MuiAlert: {
            styleOverrides: {
                root: { borderRadius: radius.base },
                standardInfo: ({ theme }) => ({
                    backgroundColor: theme.vars!.palette.mashil.surfaceSunken,
                    color: theme.vars!.palette.mashil.text,
                    "& .MuiAlert-icon": { color: theme.vars!.palette.mashil.textMuted },
                }),
                standardSuccess: ({ theme }) => ({
                    backgroundColor: theme.vars!.palette.mashil.accentSoft,
                    color: theme.vars!.palette.mashil.onAccentSoft,
                    "& .MuiAlert-icon": { color: theme.vars!.palette.mashil.accent },
                }),
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: ({ theme }) => ({ backgroundColor: theme.vars!.palette.mashil.surface }),
            },
        },
        MuiRating: {
            styleOverrides: {
                iconFilled: ({ theme }) => ({ color: theme.vars!.palette.mashil.accent }),
            },
        },
    },
});
