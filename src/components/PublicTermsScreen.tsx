import { Box, Link } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TermsPage } from "../pages/TermsPage";

/**
 * 브라우저로 약관 주소(/terms/Terms, /terms/Privacy, /terms/LocationTerms)에 들어왔을 때 보이는 화면.
 * 마실은 앱 전용이라 다른 주소는 앱 설치 안내만 보이지만, 약관과 개인정보처리방침은 누구나 웹에서 읽을 수 있어야 한다
 * (Google Play 정책). 앱 전체(로그인·지도·API)는 띄우지 않고 약관 본문만 그린다.
 */
export function PublicTermsScreen() {
    const { t } = useTranslation();
    const path = window.location.pathname.replace(/\/$/, "");
    return (
        <Box component="main" id="main" sx={{ minHeight: "100dvh", bgcolor: "var(--color-paper)", px: 2, py: 4 }}>
            {/* 주소 그대로 TermsPage 의 경로 인자를 쓰려고 메모리 라우터 (뒤로 단추는 처음 화면이라 할 일이 없다) */}
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/terms/:docType" element={<TermsPage />} />
                </Routes>
            </MemoryRouter>
            <Box sx={{ maxWidth: 640, mx: "auto", mt: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Link href="/terms/Terms" variant="body2" color="secondary">{t("consent.docs.Terms")}</Link>
                <Link href="/terms/Privacy" variant="body2" color="secondary">{t("consent.docs.Privacy")}</Link>
                <Link href="/terms/LocationTerms" variant="body2" color="secondary">{t("consent.docs.LocationTerms")}</Link>
                <Link href="/" variant="body2" color="secondary">{t("app.name")}</Link>
            </Box>
        </Box>
    );
}
