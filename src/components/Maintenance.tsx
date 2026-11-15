import { Box, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { AppStatus } from "../api";
import { formatDateTime } from "../i18n";

/**
 * 문 글리프의 세 상태: 열린 문(앱 아이콘) / 반쯤 닫힌 문(읽기 전용) / 닫힌 문(점검).
 * open = 0..1, 문짝이 열린 정도. 색은 앱 아이콘(브랜드 자산) 토큰.
 */
export function DoorGlyph({ open, size = 96 }: { open: number; size?: number }) {
    const leafRight = 33 + 34 - 12 * open; // 닫힘 67, 열림 55
    const top = 22 + 6 * open;
    const bottom = 80 - 5 * open;
    return (
        <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
            <rect width="100" height="100" fill="var(--color-door-bg)" />
            {open === 0 ? (
                // 닫힌 문: 빛 대신 문 아래 틈만
                <rect x="33" y="80.5" width="34" height="2.5" fill="var(--color-door-light)" />
            ) : (
                <rect x="33" y="22" width="34" height="58" fill="var(--color-door-light)" />
            )}
            <path d={`M33 22 L${leafRight} ${top} L${leafRight} ${bottom} L33 80 Z`} fill="var(--color-door-leaf)" />
            <circle cx={leafRight - 5} cy="53" r="2.8" fill="var(--color-door-bg)" />
        </svg>
    );
}

/**
 * 전체 점검 화면: 잉크 판 위에 닫힌 문, 다시 여는 시각(앰버 숫자), 다시 확인(주 행동), 카카오맵 대안.
 */
export function MaintenanceScreen({ status, onRetry, retrying }: { status: AppStatus; onRetry: () => void; retrying: boolean }) {
    const { t } = useTranslation();
    return (
        <Box component="main" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", px: 2, bgcolor: "var(--color-paper)" }}>
            <Stack spacing={2} sx={{ width: "100%", maxWidth: 420 }}>
                <DoorGlyph open={0} size={72} />
                <Typography component="h1" variant="h4">
                    {t("maintenance.title")}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    {status.message || t("maintenance.body")}
                </Typography>
                {status.until && (
                    <div className="plate">
                        <span className="unit">{t("maintenance.untilLabel")}</span>
                        <span className="figure">{formatDateTime(status.until)}</span>
                    </div>
                )}
                <Stack spacing={1}>
                    <Button variant="contained" size="large" onClick={onRetry} disabled={retrying}>
                        {t("maintenance.retry")}
                    </Button>
                    {/* 급한 사용자를 위한 대안. 앱 웹뷰에서는 허용 호스트가 아니라 외부(카카오맵 앱 또는 브라우저)로 열린다 */}
                    <Button variant="outlined" size="large" href="https://map.kakao.com/?q=%ED%99%94%EC%9E%A5%EC%8B%A4">
                        {t("maintenance.openKakaoMap")}
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}

/** 읽기 전용 점검 띠: 안내판의 "늦음" 행처럼 앰버 바탕 위 잉크 글자 + 반쯤 닫힌 문. */
export function ReadOnlyBanner({ status }: { status: AppStatus }) {
    const { t } = useTranslation();
    return (
        <Box role="status" className="band-soon" sx={{ px: 2, py: 1.25, display: "flex", alignItems: "center", gap: 1.5, fontSize: "var(--text-sm)", fontWeight: 800 }}>
            <DoorGlyph open={0.45} size={24} />
            <span>
                {status.until ? t("maintenance.readOnlyUntil", { time: formatDateTime(status.until) }) : t("maintenance.readOnly")}
            </span>
        </Box>
    );
}
