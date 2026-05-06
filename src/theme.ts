import { createTheme } from "@mui/material/styles";

/**
 * 마실 (Mashil) — 잠깐, 다녀와
 * Forest sage primary + warm amber accent — calm, trustworthy, with a clear CTA color for map pins.
 */
export const theme = createTheme({
    palette: {
        mode: "light",
        primary: {
            main: "#2D6A4F",
            light: "#52B788",
            dark: "#1B4332",
            contrastText: "#FFFFFF",
        },
        secondary: {
            main: "#FFB703",
            light: "#FFD166",
            dark: "#FB8500",
            contrastText: "#1B2021",
        },
        background: {
            default: "#F8F9FA",
            paper: "#FFFFFF",
        },
        text: {
            primary: "#1B2021",
            secondary: "#525B66",
        },
        divider: "#E5E7EB",
    },
    typography: {
        fontFamily: [
            "Pretendard",
            "-apple-system",
            "BlinkMacSystemFont",
            "Segoe UI",
            "Roboto",
            "sans-serif",
        ].join(","),
        h1: { fontWeight: 700 },
        h2: { fontWeight: 700 },
        button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
});
