import { Box, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { stateClass, tileStateOf } from "../design/statusTile";
import { statusOf } from "../lib/openStatus";
import type { OpenStatus } from "../lib/openStatus";

interface Props {
    toilet: Parameters<typeof statusOf>[0];
    /** short: 안내판·마커용 짧은 표기 ("24시간", "20:30까지", "종료", "정보없음") */
    variant?: "full" | "short";
}

/** 닫혀 있을 때 "내일 09:00에 열려요" 같은 다음 개방 안내. */
function closedLabel(t: TFunction, status: Extract<OpenStatus, { kind: "closed" }>): string {
    if (!status.opensAt) return t("openStatus.closedNoNext");
    if (status.opensInDays === undefined || status.opensInDays === 0) return t("openStatus.opensToday", { time: status.opensAt });
    if (status.opensInDays === 1) return t("openStatus.opensTomorrow", { time: status.opensAt });
    return t("openStatus.opensOn", { day: t(`days.${status.opensDay ?? "Mon"}`), time: status.opensAt });
}

/** 영업 상태 문구. full = 카드·상세용, short = 안내판·마커용. */
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
    if (status.kind === "closed") return closedLabel(t, status);
    return t("openStatus.unknown");
}

/** 설명 줄 (상세의 상태 판 아래) */
function statusDetail(t: TFunction, status: OpenStatus): string {
    if (status.kind === "unknown") {
        return status.raw ? t("openStatus.unknownWithRaw", { raw: status.raw }) : t("openStatus.unknownEmpty");
    }
    if (status.kind === "24h") return ""; // "24시간" 한 줄로 충분
    // 큰 글자("22:00까지")와 다른 정보: 남은 시간
    if (status.kind === "open" && status.minutesLeft !== undefined) {
        const h = Math.floor(status.minutesLeft / 60);
        const m = status.minutesLeft % 60;
        return h > 0 ? t("openStatus.leftHours", { h, m }) : t("openStatus.leftMinutes", { m });
    }
    return openStatusLabel(t, status, "full");
}

/**
 * 상세의 상태 판 — 거리 판 옆. 위: 짧은 상태(크게), 아래: 자세한 문구.
 * 상태 4단계는 app.css 의 .state--live / soon / closed / unknown.
 */
export function StatusTile({ toilet }: Omit<Props, "variant">) {
    const { t } = useTranslation();
    const status = statusOf(toilet);
    const detail = statusDetail(t, status);
    return (
        // 자세한 문구가 없으면 ("24시간"처럼 한 마디) 판 가운데에 둔다
        <div className={`plate ${stateClass(tileStateOf(status))}${detail ? "" : " is-single"}`}>
            <span className="figure">{openStatusLabel(t, status, "short")}</span>
            {detail && <span className="unit">{detail}</span>}
        </div>
    );
}

/** 상태 칸 — 한 줄에 들어가는 작은 표시. 툴팁은 공공데이터 원문(번역하지 않음). */
export function OpenStatusBadge({ toilet, variant = "full" }: Props) {
    const { t } = useTranslation();
    const status = statusOf(toilet);
    const tooltip = status.kind === "unknown" ? statusDetail(t, status) : status.raw;
    return (
        <Tooltip title={tooltip} enterDelay={800}>
            <Box
                component="span"
                className={stateClass(tileStateOf(status))}
                sx={{ display: "inline-flex", alignItems: "center", minHeight: 28, px: 1, fontSize: "var(--text-sm)", fontWeight: 800, whiteSpace: "nowrap" }}
            >
                {openStatusLabel(t, status, variant)}
            </Box>
        </Tooltip>
    );
}
