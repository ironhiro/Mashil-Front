import { Box, Container } from "@mui/material";
import { Route, Routes, useLocation } from "react-router-dom";
import { BottomNav, showsBottomNav } from "./components/BottomNav";
import { RequireAdmin } from "./components/RequireAdmin";
import { AdminChangeRequestsPage } from "./pages/AdminChangeRequestsPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MePage } from "./pages/MePage";
import { NewChangeRequestPage } from "./pages/NewChangeRequestPage";
import { ConsentPage } from "./pages/ConsentPage";
import { TermsPage } from "./pages/TermsPage";
import { ToiletDetailPage } from "./pages/ToiletDetailPage";
import { MaintenanceScreen, ReadOnlyBanner } from "./components/Maintenance";
import { useAppStatus } from "./lib/appStatus";

export function App() {
    const appStatus = useAppStatus();
    const { pathname } = useLocation();
    const withNav = showsBottomNav(pathname);

    // 전체 점검이면 다른 화면 대신 점검 화면 (OPS-05)
    if (appStatus.data?.maintenance) {
        return <MaintenanceScreen status={appStatus.data} onRetry={() => void appStatus.refetch()} retrying={appStatus.isFetching} />;
    }

    // 위쪽 앱 바와 왼쪽 서랍 대신 하단 탭 세 칸 (찾기 / 제보 / 내 정보)
    return (
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }} className={withNav ? "has-bottom-nav" : undefined}>
            {appStatus.data?.readOnly && <ReadOnlyBanner status={appStatus.data} />}

            <Container maxWidth="md" sx={{ py: 3, flex: 1 }}>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/me" element={<MePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/consent" element={<ConsentPage />} />
                    <Route path="/terms/:docType" element={<TermsPage />} />
                    <Route path="/toilets/:id" element={<ToiletDetailPage />} />
                    <Route path="/change-requests/new" element={<NewChangeRequestPage />} />
                    <Route
                        path="/admin/change-requests"
                        element={
                            <RequireAdmin>
                                <AdminChangeRequestsPage />
                            </RequireAdmin>
                        }
                    />
                </Routes>
            </Container>
            {withNav && <BottomNav />}
        </Box>
    );
}
