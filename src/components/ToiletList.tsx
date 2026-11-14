import { Box, ButtonBase, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { ToiletNear } from "../api";
import { tileStateOf, tileSx } from "../design/statusTile";
import { fonts } from "../design/tokens";
import { formatDistance } from "../i18n";
import { facilityChipLabels } from "../lib/facilityChips";
import { parseOpenStatus } from "../lib/openStatus";
import { openStatusLabel } from "./OpenStatusBadge";

interface Props {
    toilets: ToiletNear[];
    /** 필터 적용 전 전체 개수. 같으면 필터가 걸리지 않은 것으로 보고 안내하지 않음. */
    totalBeforeFilter?: number;
    selectedId: number | null;
    onSelect: (t: ToiletNear) => void;
}

/**
 * 거리순 화장실 타일 (docs/07-ui-design.md "C. 타일").
 * 정보 위계: 거리 숫자 → 이름 → 상태 → 시설. 타일 배경이 영업 상태 4단계를 나타낸다.
 */
export function ToiletList({ toilets, totalBeforeFilter, selectedId, onSelect }: Props) {
    const { t } = useTranslation();
    const filtered = totalBeforeFilter !== undefined && totalBeforeFilter !== toilets.length;

    return (
        <Box>
            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {t("list.total", { count: toilets.length })}
                </Typography>
                {filtered && (
                    <Typography variant="caption" color="text.secondary">
                        {t("list.filtered", { total: totalBeforeFilter!.toLocaleString() })}
                    </Typography>
                )}
            </Box>

            {toilets.length === 0 ? (
                <Box
                    sx={{
                        py: 4,
                        textAlign: "center",
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "mashil.line",
                        bgcolor: "mashil.surface",
                    }}
                >
                    <Typography color="text.secondary">{t("list.empty")}</Typography>
                </Box>
            ) : (
                <Box
                    component="ul"
                    sx={{
                        listStyle: "none",
                        m: 0,
                        p: 0,
                        display: "grid",
                        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))" },
                        gap: 1,
                    }}
                >
                    {toilets.map((toilet) => {
                        const status = parseOpenStatus(toilet.openHours, toilet.openHoursDetail);
                        const state = tileStateOf(status);
                        const selected = toilet.id === selectedId;
                        return (
                            <li key={toilet.id}>
                                <ButtonBase
                                    onClick={() => onSelect(toilet)}
                                    aria-pressed={selected}
                                    sx={{
                                        ...tileSx(state),
                                        width: "100%",
                                        minHeight: 116,
                                        boxSizing: "border-box",
                                        borderRadius: 1,
                                        p: 1.5,
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "stretch",
                                        justifyContent: "space-between",
                                        gap: 0.75,
                                        textAlign: "left",
                                        // 선택은 색이 아니라 굵은 먹색 외곽선으로
                                        outline: selected ? "3px solid" : "none",
                                        outlineColor: "mashil.selected",
                                        outlineOffset: 2,
                                    }}
                                >
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
                                        <Box component="span" sx={{ fontFamily: fonts.mono, fontSize: 22, lineHeight: 1 }}>
                                            {formatDistance(toilet.distanceM, true)}
                                        </Box>
                                        <Box component="span" sx={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                                            {openStatusLabel(t, status, "short")}
                                        </Box>
                                    </Box>
                                    <Box component="span" sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>
                                        {toilet.name}
                                    </Box>
                                    <Box component="span" sx={{ fontSize: 12, opacity: 0.85 }}>
                                        {facilityChipLabels(t, toilet, "compact").join(" · ")}
                                    </Box>
                                </ButtonBase>
                            </li>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}
