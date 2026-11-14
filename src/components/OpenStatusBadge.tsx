import { Box, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { tileStateOf, tileSx } from "../design/statusTile";
import { parseOpenStatus } from "../lib/openStatus";
import type { OpenStatus } from "../lib/openStatus";

interface Props {
    openHours: string | null;
    openHoursDetail: string | null;
    /** short: 타일·마커용 짧은 표기 ("24시간", "20:30까지", "종료", "정보없음") */
    variant?: "full" | "short";
}

/** 영업 상태 문구. full = 카드용, short = 타일·마커용. */
export function openStatusLabel(t: TFunction, status: OpenStatus, variant: "full" | "short"): string {
    if (variant === "short") {
        if (status.kind === "24h") return t("openStatus.short.always");
        if (status.kind === "open") return t("openStatus.short.until", { time: status.closesAt });
        if (status.kind === "closed") return t("openStatus.short.closed");
        return t("openStatus.short.unknown");
    }
    if (status.kind === "24h") return t("openStatus.always");
    if (status.kind === "open") {
        return status.closingSoon
            ? t("openStatus.closingSoon", { time: status.closesAt })
            : t("openStatus.openUntil", { time: status.closesAt });
    }
    if (status.kind === "closed") return t("openStatus.closedUntil", { time: status.opensAt });
    return t("openStatus.unknown");
}

/**
 * 상세 카드의 큰 상태 타일 — 거리 타일 옆에 나란히. 위: 짧은 상태(크게), 아래: 자세한 문구.
 */
export function StatusTile({ openHours, openHoursDetail }: Omit<Props, "variant">) {
    const { t } = useTranslation();
    const status = parseOpenStatus(openHours, openHoursDetail);
    const detail =
        status.kind === "unknown"
            ? status.raw
                ? t("openStatus.unknownWithRaw", { raw: status.raw })
                : t("openStatus.unknownEmpty")
            : status.kind === "24h"
              ? t("openStatus.alwaysDetail")
              : openStatusLabel(t, status, "full");
    return (
        <Box
            sx={{
                ...tileSx(tileStateOf(status)),
                borderRadius: 1,
                p: 1.5,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 0.5,
                minWidth: 0,
            }}
        >
            <Box component="span" sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>
                {openStatusLabel(t, status, "short")}
            </Box>
            <Box component="span" sx={{ fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>
                {detail}
            </Box>
        </Box>
    );
}

/**
 * 영업 상태 칩 — 타일 4단계(열림 채움 / 곧 닫힘 연한 채움 / 종료 점선 / 정보없음 회색).
 * 툴팁은 공공데이터 원문(번역하지 않음) 또는 "가기 전에 확인" 안내.
 */
export function OpenStatusBadge({ openHours, openHoursDetail, variant = "full" }: Props) {
    const { t } = useTranslation();
    const status = parseOpenStatus(openHours, openHoursDetail);
    const state = tileStateOf(status);
    const tooltip =
        status.kind === "unknown"
            ? status.raw
                ? t("openStatus.unknownWithRaw", { raw: status.raw })
                : t("openStatus.unknownEmpty")
            : status.raw;

    return (
        <Tooltip title={tooltip}>
            <Box
                component="span"
                sx={{
                    ...tileSx(state),
                    display: "inline-flex",
                    alignItems: "center",
                    height: 26,
                    px: 1,
                    borderRadius: 1,
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    boxSizing: "border-box",
                }}
            >
                {openStatusLabel(t, status, variant)}
            </Box>
        </Tooltip>
    );
}
