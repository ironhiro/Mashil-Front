import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useAuth, userLabel } from "../auth/AuthContext";
import { SUPPORTED_LANGUAGES, currentLanguage } from "../i18n";
import type { LanguageCode } from "../i18n";
import { UserRole } from "../lib/enums";

/** 하단 탭 "내 정보": 계정, 관리자 메뉴, 언어. 예전 왼쪽 서랍 메뉴의 내용을 옮겼다. */
export function MePage() {
    const auth = useAuth();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const isAdmin = auth.user?.role === UserRole.Admin;

    return (
        <Stack spacing={3}>
            <Typography variant="h4" component="h1">
                {t("me.title")}
            </Typography>

            <Box className="plate">
                {auth.user ? (
                    <>
                        <Typography sx={{ fontWeight: 800, fontSize: "var(--text-xl)" }}>{userLabel(auth.user)}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {isAdmin ? t("app.roleAdmin") : t("app.roleUser")}
                        </Typography>
                    </>
                ) : (
                    <>
                        <Typography>{t("me.guest")}</Typography>
                        <Button variant="contained" size="large" fullWidth component={RouterLink} to="/login" sx={{ mt: 2 }}>
                            {t("nav.loginOrRegister")}
                        </Button>
                    </>
                )}
            </Box>

            {isAdmin && (
                <Button variant="outlined" size="large" component={RouterLink} to="/admin/change-requests">
                    {t("nav.review")}
                </Button>
            )}

            <Box>
                <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                    {/* 언어 이름은 번역하지 않고 각 언어로 표기 (내가 못 읽는 언어로 바뀌어도 돌아올 수 있게) */}
                    {t("nav.language")}
                    {currentLanguage() !== "en" && " / Language"}
                </Typography>
                <ToggleButtonGroup
                    exclusive
                    fullWidth
                    value={currentLanguage()}
                    onChange={(_, v: LanguageCode | null) => v && void i18n.changeLanguage(v)}
                    aria-label={t("nav.language")}
                >
                    {SUPPORTED_LANGUAGES.map((l) => (
                        <ToggleButton key={l.code} value={l.code} lang={l.code}>
                            {l.label}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>

            {auth.user && (
                <Button
                    variant="outlined"
                    size="large"
                    onClick={() => {
                        auth.logout();
                        navigate("/");
                    }}
                >
                    {t("nav.logout")}
                </Button>
            )}
        </Stack>
    );
}
