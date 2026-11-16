import { Box, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { DoorGlyph } from "./Maintenance";

const PLAY_URL = import.meta.env.VITE_PLAY_STORE_URL;
const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL;

/**
 * 브라우저로 들어온 사람에게 보이는 화면 (마실은 앱 전용, lib/browserGate.ts).
 * 스토어 주소가 아직 없으면 "곧 나와요" 안내만. 급한 사람을 위한 대안으로 카카오맵 검색 (점검 화면과 같은 대안).
 */
export function GetAppScreen() {
    const { t } = useTranslation();
    const sharedToilet = /^\/toilets\/\d+/.test(window.location.pathname);
    return (
        <Box component="main" id="main" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", px: 2, bgcolor: "var(--color-paper)" }}>
            <Stack spacing={2} sx={{ width: "100%", maxWidth: 420 }}>
                <DoorGlyph open={1} size={72} />
                <Typography component="h1" variant="h4">
                    {t("getApp.title")}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    {sharedToilet ? t("getApp.sharedBody") : t("getApp.body")}
                </Typography>
                <Stack spacing={1}>
                    {PLAY_URL && (
                        <Button variant="contained" size="large" href={PLAY_URL}>
                            {t("getApp.googlePlay")}
                        </Button>
                    )}
                    {APP_STORE_URL && (
                        <Button variant="contained" size="large" href={APP_STORE_URL}>
                            {t("getApp.appStore")}
                        </Button>
                    )}
                    {!PLAY_URL && !APP_STORE_URL && (
                        <Typography variant="body2" color="text.secondary">
                            {t("getApp.comingSoon")}
                        </Typography>
                    )}
                    <Button variant="outlined" size="large" href="https://map.kakao.com/?q=%ED%99%94%EC%9E%A5%EC%8B%A4">
                        {t("maintenance.openKakaoMap")}
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}
