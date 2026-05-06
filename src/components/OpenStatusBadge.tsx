import { Chip, Tooltip } from "@mui/material";
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
 * - 미상 → 검정 + 툴팁 "직접 방문 확인 필요"
 */
export function OpenStatusBadge({ openHours, openHoursDetail, size = "small" }: Props) {
    const status = parseOpenStatus(openHours, openHoursDetail);

    if (status.kind === "24h") {
        return (
            <Tooltip title={status.raw}>
                <Chip color="success" size={size} label="24시간 영업" />
            </Tooltip>
        );
    }
    if (status.kind === "open") {
        return (
            <Tooltip title={status.raw}>
                <Chip color="success" size={size} label={`영업중 ~${status.closesAt}`} />
            </Tooltip>
        );
    }
    if (status.kind === "closed") {
        return (
            <Tooltip title={status.raw}>
                <Chip color="error" size={size} label={`영업종료 (${status.opensAt}~)`} />
            </Tooltip>
        );
    }

    // unknown
    const tooltipText = status.raw
        ? `영업시간 정보를 해석할 수 없어요 ("${status.raw}"). 직접 방문하여 확인해 주세요.`
        : "영업시간 정보가 없어요. 직접 방문하여 확인해 주세요.";
    return (
        <Tooltip title={tooltipText}>
            <Chip
                size={size}
                label="영업시간 미상"
                sx={{
                    bgcolor: "grey.900",
                    color: "common.white",
                    "& .MuiChip-label": { color: "common.white" },
                }}
            />
        </Tooltip>
    );
}
