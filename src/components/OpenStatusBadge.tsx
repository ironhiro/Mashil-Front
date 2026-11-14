import { Chip, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { parseOpenStatus } from "../lib/openStatus";

interface Props {
    openHours: string | null;
    openHoursDetail: string | null;
    /** 칩 크기. 기본 small. */
    size?: "small" | "medium";
}

/**
 * 영업 상태를 한 눈에 보여주는 색상 칩.
 * - 24시간(상시) → 초록 "24시간 영업"
 * - 영업중 → 초록 "영업중 ~HH:MM"
 * - 영업종료 → 빨강 "영업종료 (HH:MM~)"
 * - 미상 → 검정 + 툴팁 "가기 전에 확인"
 * 툴팁의 원문(status.raw)은 공공데이터 그대로라 번역하지 않는다.
 */
export function OpenStatusBadge({ openHours, openHoursDetail, size = "small" }: Props) {
    const { t } = useTranslation();
    const status = parseOpenStatus(openHours, openHoursDetail);

    if (status.kind === "24h") {
        return (
            <Tooltip title={status.raw}>
                <Chip color="success" size={size} label={t("openStatus.always")} />
            </Tooltip>
        );
    }
    if (status.kind === "open") {
        return (
            <Tooltip title={status.raw}>
                <Chip color="success" size={size} label={t("openStatus.openUntil", { time: status.closesAt })} />
            </Tooltip>
        );
    }
    if (status.kind === "closed") {
        return (
            <Tooltip title={status.raw}>
                <Chip color="error" size={size} label={t("openStatus.closedUntil", { time: status.opensAt })} />
            </Tooltip>
        );
    }

    // unknown
    const tooltipText = status.raw
        ? t("openStatus.unknownWithRaw", { raw: status.raw })
        : t("openStatus.unknownEmpty");
    return (
        <Tooltip title={tooltipText}>
            <Chip
                size={size}
                label={t("openStatus.unknown")}
                sx={{
                    bgcolor: "grey.900",
                    color: "common.white",
                    "& .MuiChip-label": { color: "common.white" },
                }}
            />
        </Tooltip>
    );
}
