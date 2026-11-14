import {
    Box,
    Chip,
    List,
    ListItemButton,
    ListItemText,
    Stack,
    Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { ToiletNear } from "../api";
import { formatDistance } from "../i18n";
import { facilityChipLabels, toiletKindLabel } from "../lib/facilityChips";
import { OpenStatusBadge } from "./OpenStatusBadge";

interface Props {
    toilets: ToiletNear[];
    /** 필터 적용 전 전체 개수. 같으면 "필터 적용 안 됨" 으로 간주되어 표시 안 함. */
    totalBeforeFilter?: number;
    selectedId: number | null;
    onSelect: (t: ToiletNear) => void;
}

/** 거리순 화장실 리스트 — 맵 뷰의 대안. 클릭 시 카드와 동일하게 selectedToilet 업데이트. */
export function ToiletList({ toilets, totalBeforeFilter, selectedId, onSelect }: Props) {
    const { t } = useTranslation();
    const filtered = totalBeforeFilter !== undefined && totalBeforeFilter !== toilets.length;

    return (
        <Box
            sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
            }}
        >
            <Box
                sx={{
                    px: 2,
                    py: 1,
                    bgcolor: "grey.50",
                    borderBottom: 1,
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                }}
            >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t("list.total", { count: toilets.length })}
                </Typography>
                {filtered && (
                    <Typography variant="caption" color="text.secondary">
                        {t("list.filtered", { total: totalBeforeFilter!.toLocaleString() })}
                    </Typography>
                )}
            </Box>

            {toilets.length === 0 ? (
                <Box sx={{ py: 4, textAlign: "center" }}>
                    <Typography color="text.secondary">{t("list.empty")}</Typography>
                </Box>
            ) : (
                <Box sx={{ maxHeight: { xs: 400, sm: 520 }, overflowY: "auto" }}>
                    <List disablePadding>
                {toilets.map((toilet) => {
                    const facilityChips = facilityChipLabels(t, toilet, "compact");
                    const addr = toilet.roadAddress ?? toilet.lotAddress ?? "";
                    const distLabel = formatDistance(toilet.distanceM);
                    return (
                        <ListItemButton
                            key={toilet.id}
                            selected={toilet.id === selectedId}
                            onClick={() => onSelect(toilet)}
                            sx={{ alignItems: "flex-start", py: 1.25 }}
                        >
                            <ListItemText
                                slotProps={{
                                    // 기본은 <p> 라 내부에 <div>(Stack/Chip) 가 들어가면 hydration 에러.
                                    // 두 슬롯 모두 div 로 강제.
                                    primary: { component: "div" },
                                    secondary: { component: "div" },
                                }}
                                primary={
                                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                            {toilet.name}
                                        </Typography>
                                        <Chip size="small" label={toiletKindLabel(t, toilet.kind)} variant="outlined" />
                                        <Typography variant="caption" color="text.secondary">
                                            {distLabel}
                                        </Typography>
                                    </Stack>
                                }
                                secondary={
                                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                        {addr && (
                                            <Typography variant="caption" color="text.secondary">
                                                {addr}
                                            </Typography>
                                        )}
                                        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" alignItems="center">
                                            <OpenStatusBadge
                                                openHours={toilet.openHours}
                                                openHoursDetail={toilet.openHoursDetail}
                                            />
                                            {facilityChips.map((label) => (
                                                <Chip
                                                    key={label}
                                                    size="small"
                                                    label={label}
                                                    sx={{ height: 22, fontSize: 11 }}
                                                />
                                            ))}
                                        </Stack>
                                    </Stack>
                                }
                            />
                        </ListItemButton>
                    );
                })}
                    </List>
                </Box>
            )}
        </Box>
    );
}
