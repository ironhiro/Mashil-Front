import { lazy, Suspense, useEffect, useRef } from "react";
import { Box, CircularProgress, Container } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { BottomNav, showsBottomNav } from "./components/BottomNav";
import { RequireAdmin } from "./components/RequireAdmin";
// 찾기와 상세는 첫 화면과 가장 잦은 이동이라 바로 싣고, 나머지 화면은 처음 열 때 받는다 (첫 로딩 번들을 줄인다)
import { HomePage } from "./pages/HomePage";
import { ToiletDetailPage } from "./pages/ToiletDetailPage";

/** 이름 있는 export 를 React.lazy 가 받는 default 모양으로 */
function page<K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) {
    return lazy(() => load().then((m) => ({ default: m[name] })));
}
const WalkGuidePage = page(() => import("./pages/WalkGuidePage"), "WalkGuidePage");
const LoginPage = page(() => import("./pages/LoginPage"), "LoginPage");
const MePage = page(() => import("./pages/MePage"), "MePage");
const SettingsPage = page(() => import("./pages/SettingsPage"), "SettingsPage");
const NewChangeRequestPage = page(() => import("./pages/NewChangeRequestPage"), "NewChangeRequestPage");
const ConsentPage = page(() => import("./pages/ConsentPage"), "ConsentPage");
const TermsPage = page(() => import("./pages/TermsPage"), "TermsPage");
const AboutPage = page(() => import("./pages/AboutPage"), "AboutPage");
const AdminChangeRequestsPage = page(() => import("./pages/AdminChangeRequestsPage"), "AdminChangeRequestsPage");
const AdminCommentReportsPage = page(() => import("./pages/AdminCommentReportsPage"), "AdminCommentReportsPage");
const AdminHomePage = page(() => import("./pages/AdminHomePage"), "AdminHomePage");
const AdminImportsPage = page(() => import("./pages/AdminImportsPage"), "AdminImportsPage");
const AdminIssuesPage = page(() => import("./pages/AdminIssuesPage"), "AdminIssuesPage");
const AdminStatusPage = page(() => import("./pages/AdminStatusPage"), "AdminStatusPage");
const AdminToiletPage = page(() => import("./pages/AdminToiletPage"), "AdminToiletPage");
const NotFoundPage = page(() => import("./pages/NotFoundPage"), "NotFoundPage");
import { MaintenanceScreen, ReadOnlyBanner } from "./components/Maintenance";
import { useAppStatus } from "./lib/appStatus";
import { useAuth } from "./auth/AuthContext";
import { UserRole } from "./lib/enums";
import { isOnboarded, markOnboarded } from "./lib/firstRun";
import { useKeyboardOpen } from "./lib/useKeyboardOpen";

/** 관리 화면 경로 → 화면. 모두 RequireAdmin 으로 감싼다 */
const ADMIN_ROUTES = [
    { path: "/admin", element: <AdminHomePage /> },
    { path: "/admin/change-requests", element: <AdminChangeRequestsPage /> },
    { path: "/admin/comments", element: <AdminCommentReportsPage /> },
    { path: "/admin/issues", element: <AdminIssuesPage /> },
    { path: "/admin/imports", element: <AdminImportsPage /> },
    { path: "/admin/toilets/:id", element: <AdminToiletPage /> },
    { path: "/admin/status", element: <AdminStatusPage /> },
];

/** 화면을 처음 열 때 코드를 받는 동안 */
function PageLoading() {
    const { t } = useTranslation();
    return (
        <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
            <CircularProgress aria-label={t("common.loadingPage")} />
        </Box>
    );
}

/**
 * 화면이 바뀌면 포커스를 새 화면의 제목(h1)으로 옮기고 탭 제목도 맞춘다. SPA 는 페이지를 새로 읽지 않아서,
 * 그대로 두면 스크린리더가 화면이 바뀐 줄 모르고 포커스가 사라진 버튼에 남는다. 첫 화면에서는 건드리지 않는다.
 */
function useRouteFocus(pathname: string) {
    // 직전에 포커스를 옮긴 경로. 첫 화면은 여기서 시작해 건너뛴다 (StrictMode 가 효과를 두 번 돌려도 그대로)
    const last = useRef(pathname);
    const navType = useNavigationType();
    useEffect(() => {
        if (last.current === pathname) return;
        last.current = pathname;
        // 새 화면은 맨 위에서 시작한다 (상세·제보 양식이 앞 화면의 스크롤 위치로 열리지 않게). 뒤로 가기는 위치 유지
        if (navType !== "POP") window.scrollTo(0, 0);
        let tries = 0;
        let frame = 0;
        const focusHeading = () => {
            const main = document.getElementById("main");
            const h1 = main?.querySelector<HTMLElement>("h1");
            // 나중에 받는 화면은 제목이 조금 늦게 생긴다
            if (!h1 && tries++ < 20) {
                frame = requestAnimationFrame(focusHeading);
                return;
            }
            const target = h1 ?? main;
            if (!target) return;
            if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
            target.focus({ preventScroll: true });
            const base = document.title.split(" · ").pop() ?? document.title;
            document.title = h1?.textContent ? `${h1.textContent} · ${base}` : base;
        };
        frame = requestAnimationFrame(focusHeading);
        return () => cancelAnimationFrame(frame);
    }, [pathname, navType]);
}

/**
 * 메인(/)에 처음 들어오면 로그인 화면으로 (로그인 없이 둘러보기 포함). 로그인했거나 한 번 둘러보기를 골랐으면 그대로 메인.
 * 공유 링크(/toilets/…) 같은 다른 주소로 처음 들어온 경우에는 막지 않는다.
 */
function FirstRunGate({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    if (user) {
        markOnboarded();
        return <>{children}</>;
    }
    return isOnboarded() ? <>{children}</> : <Navigate to="/login" replace />;
}

export function App() {
    const appStatus = useAppStatus();
    const { pathname } = useLocation();
    const withNav = showsBottomNav(pathname);
    // 키보드가 올라오면 하단 탭을 숨긴다 (app.css .keyboard-open, 폰 폭에서만)
    const keyboardOpen = useKeyboardOpen();
    const isAdmin = useAuth().user?.role === UserRole.Admin;
    useRouteFocus(pathname);

    // 전체 점검이면 다른 화면 대신 점검 화면 (OPS-05). 관리자는 점검을 끌 수 있어야 하므로 띠만 보고 그대로 쓴다.
    // 로그인 화면은 열어 둔다: 로그아웃된 관리자가 들어와 점검을 끌 수 있게 (서버도 점검 중 /api/auth 는 막지 않는다)
    const loginDuringMaintenance = pathname === "/login" && !isAdmin;
    if (appStatus.data?.maintenance && !isAdmin && !loginDuringMaintenance) {
        return <MaintenanceScreen status={appStatus.data} onRetry={() => void appStatus.refetch()} retrying={appStatus.isFetching} />;
    }

    // 위쪽 앱 바와 왼쪽 서랍 대신 하단 탭 세 칸 (찾기 / 제보 / 내 정보)
    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }} className={["app-root", withNav && "has-bottom-nav", keyboardOpen && "keyboard-open"].filter(Boolean).join(" ")}>
            {appStatus.data?.maintenance ? (
                <ReadOnlyBanner status={appStatus.data} text={isAdmin ? "adminConsole.adminMaintenanceBanner" : "maintenance.loginOnly"} />
            ) : (
                appStatus.data?.readOnly && <ReadOnlyBanner status={appStatus.data} />
            )}

            {/* 홈은 넓은 화면에서 목록과 지도를 나란히 놓으므로 넓게, 나머지(글·양식)는 읽기 좋은 폭 */}
            <Container component="main" id="main" maxWidth={pathname === "/" ? "xl" : "md"} sx={{ py: 3, flex: 1 }}>
                <Suspense fallback={<PageLoading />}>
                <Routes>
                    <Route path="/" element={<FirstRunGate><HomePage /></FirstRunGate>} />
                    <Route path="/me" element={<MePage />} />
                    <Route path="/me/settings" element={<SettingsPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/consent" element={<ConsentPage />} />
                    <Route path="/terms/:docType" element={<TermsPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/toilets/:id" element={<ToiletDetailPage />} />
                    <Route path="/toilets/:id/guide" element={<WalkGuidePage />} />
                    <Route path="/change-requests/new" element={<NewChangeRequestPage />} />
                    {ADMIN_ROUTES.map((r) => (
                        <Route key={r.path} path={r.path} element={<RequireAdmin>{r.element}</RequireAdmin>} />
                    ))}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
                </Suspense>
            </Container>
            {withNav && <BottomNav />}
        </Box>
    );
}
