import { StrictMode } from "react";
// Overpass 라틴 글꼴을 번들에 함께 (외부 글꼴 CSS 가 첫 화면을 막지 않게, 방문 기록을 Google 에 보내지 않게)
import "@fontsource/overpass/latin-400.css";
import "@fontsource/overpass/latin-500.css";
import "@fontsource/overpass/latin-700.css";
import "@fontsource/overpass/latin-800.css";
import "./styles/app.css";
import "./i18n";
import "./i18n/syncAppLanguage";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { theme } from "./theme";
import { App } from "./App";

// 에러 모니터링 (NFR-10) — VITE_SENTRY_DSN 이 있는 빌드에서만 켠다. 별도 청크로 나중에 받아 첫 화면 번들에 넣지 않는다
// (DSN 이 없는 빌드는 이 블록과 청크가 통째로 빠진다). 개인정보는 보내지 않고, URL 의 위치 쿼리는 지운다 (NFR-06).
if (import.meta.env.VITE_SENTRY_DSN) {
    void import("@sentry/react").then(({ init }) => {
        const scrub = (url?: string) => url?.replace(/([?&](?:lat|lng|north|south|east|west)=)[^&#]*/gi, "$1[Filtered]");
        init({
            dsn: import.meta.env.VITE_SENTRY_DSN,
            environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
            release: import.meta.env.VITE_RELEASE || undefined,
            // 통신에 끼어들지 않게: 오류만 모으고 추적(browserTracingIntegration)은 켜지 않으며, API·카카오·Google 요청에
            // sentry-trace·baggage 헤더를 붙이지 않는다. 그 헤더를 허용하지 않는 서버로 가는 요청이 CORS 사전 요청에서
            // 막혀 통신이 깨진 적이 있다 (백엔드도 같은 설정, Mashil.Api/Ops/ErrorMonitoring.cs).
            tracePropagationTargets: [],
            tracesSampleRate: 0,
            // Sentry 11: sendDefaultPii 대신 dataCollection. 사용자·쿠키·헤더·본문은 모으지 않고 위치 쿼리는 뺀다
            dataCollection: {
                userInfo: false,
                cookies: false,
                httpHeaders: false,
                httpBodies: [],
                urlQueryParams: { deny: ["lat", "lng", "north", "south", "east", "west"] },
            },
            beforeSend(event) {
                if (event.request) {
                    event.request.url = scrub(event.request.url);
                    delete event.request.query_string;
                    delete event.request.cookies;
                }
                return event;
            },
            beforeBreadcrumb(crumb) {
                if (crumb.data) {
                    for (const key of ["url", "from", "to"]) {
                        if (typeof crumb.data[key] === "string") crumb.data[key] = scrub(crumb.data[key]);
                    }
                }
                return crumb;
            },
        });
    });
}

// 개발 서버에서만: 접근성 위반을 콘솔에 적는다 (운영 빌드에서는 이 블록이 빠진다)
if (import.meta.env.DEV) {
    void import("./dev/axeAudit").then(({ startAxeAudit }) => startAxeAudit());
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 30_000, retry: 1 },
    },
});

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <AuthProvider>
                        <App />
                    </AuthProvider>
                </BrowserRouter>
            </QueryClientProvider>
        </ThemeProvider>
    </StrictMode>,
);
