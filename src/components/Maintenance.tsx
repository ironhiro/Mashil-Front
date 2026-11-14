import { Box, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { AppStatus } from "../api";
import { fonts, tileGrid } from "../design/tokens";
import { formatDateTime } from "../i18n";

/**
 * 문 아이콘의 세 상태 (docs/07-ui-design.md §7): 열린 문(앱 아이콘) / 반쯤 닫힌 문(읽기 전용) / 닫힌 문(점검).
 * open = 0..1 — 문짝이 열린 정도.
 */
export function DoorGlyph({ open, size = 96, bg = "#1F6F69" }: { open: number; size?: number; bg?: string }) {
    const leafRight = 33 + 34 - 12 * open; // 닫힘 67 → 열림 55
    const top = 22 + 6 * open;
    const bottom = 80 - 5 * open;
    return (
        <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
            <rect width="100" height="100" rx="22" fill={bg} />
            {open === 0 ? (
                // 닫힌 문: 빛 대신 문 아래 틈만
                <rect x="33" y="80.5" width="34" height="2.5" fill="#7FE0D3" />
            ) : (
                <rect x="33" y="22" width="34" height="58" rx="2" fill="#7FE0D3" />
            )}
            <path d={`M33 22 L${leafRight} ${top} L${leafRight} ${bottom} L33 80 Z`} fill="#FFFFFF" />
            <circle cx={leafRight - 5} cy="53" r="2.8" fill={bg} />
        </svg>
    );
}

/** 전체 점검 화면: 닫힌 문 · "문이 잠시 닫혔어요" · 다시 여는 시각 · 다시 확인(주 행동) · 카카오맵 대안. */
export function MaintenanceScreen({ status, onRetry, retrying }: { status: AppStatus; onRetry: () => void; retrying: boolean }) {
    const { t } = useTranslation();
    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 3,
                bgcolor: "mashil.bg",
                backgroundImage: tileGrid("var(--mui-palette-mashil-surfaceSunken)"),
            }}
        >
            <Stack spacing={1.5} alignItems="center" sx={{ maxWidth: 360, textAlign: "center", bgcolor: "mashil.bg", p: 3, borderRadius: 1 }}>
                <DoorGlyph open={0} />
                <Typography sx={{ fontFamily: fonts.logo, fontSize: 30, lineHeight: 1.2 }}>{t("maintenance.title")}</Typography>
                <Typography variant="body2" color="text.secondary">
                    {status.message || t("maintenance.body")}
                </Typography>
                {status.until && (
                    <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
                        {t("maintenance.until", { time: formatDateTime(status.until) })}
                    </Typography>
                )}
                <Stack spacing={1} sx={{ width: "100%", pt: 1.5 }}>
                    <Button variant="contained" size="large" onClick={onRetry} disabled={retrying}>
                        {t("maintenance.retry")}
                    </Button>
                    {/* 급한 사용자를 위한 대안. 앱 웹뷰에서는 허용 호스트가 아니라 외부(카카오맵 앱/브라우저)로 열린다 */}
                    <Button color="secondary" variant="outlined" size="large" href="https://map.kakao.com/?q=%ED%99%94%EC%9E%A5%EC%8B%A4">
                        {t("maintenance.openKakaoMap")}
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}

/** 읽기 전용 점검 배너: 검색창 아래 먹색 띠 + 반쯤 닫힌 문. */
export function ReadOnlyBanner({ status }: { status: AppStatus }) {
    const { t } = useTranslation();
    return (
        <Box
            role="status"
            sx={{
                bgcolor: "mashil.selected",
                color: "mashil.onSelected",
                px: 2,
                py: 1,
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                fontSize: 14,
                fontWeight: 600,
            }}
        >
            <DoorGlyph open={0.45} size={22} />
            <span>
                {status.until
                    ? t("maintenance.readOnlyUntil", { time: formatDateTime(status.until) })
                    : t("maintenance.readOnly")}
            </span>
        </Box>
    );
}
