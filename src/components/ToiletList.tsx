import {
    Box,
    Chip,
    List,
    ListItemButton,
    ListItemText,
    Stack,
    Typography,
} from "@mui/material";
import type { ToiletNear } from "../api";
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
                    총 {toilets.length.toLocaleString()}곳
                </Typography>
                {filtered && (
                    <Typography variant="caption" color="text.secondary">
                        필터 적용 — 전체 {totalBeforeFilter!.toLocaleString()}곳 중
                    </Typography>
                )}
            </Box>

            {toilets.length === 0 ? (
                <Box sx={{ py: 4, textAlign: "center" }}>
                    <Typography color="text.secondary">조건에 맞는 화장실이 없어요.</Typography>
                </Box>
            ) : (
                <Box sx={{ maxHeight: { xs: 400, sm: 520 }, overflowY: "auto" }}>
                    <List disablePadding>
                {toilets.map((t) => {
                    const facilityChips = collectFacilityChips(t);
                    const addr = t.roadAddress ?? t.lotAddress ?? "";
                    const distLabel = t.distanceM < 1000
                        ? `${Math.round(t.distanceM)} m`
                        : `${(t.distanceM / 1000).toFixed(1)} km`;
                    return (
                        <ListItemButton
                            key={t.id}
                            selected={t.id === selectedId}
                            onClick={() => onSelect(t)}
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
                                            {t.name}
                                        </Typography>
                                        <Chip size="small" label={t.kind} variant="outlined" />
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
                                                openHours={t.openHours}
                                                openHoursDetail={t.openHoursDetail}
                                            />
                                            {facilityChips.map((c) => (
                                                <Chip
                                                    key={c.label}
                                                    size="small"
                                                    label={c.label}
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

interface FacilityChip {
    label: string;
}

function collectFacilityChips(t: ToiletNear): FacilityChip[] {
    const chips: FacilityChip[] = [];
    const men = t.maleStallCount + t.maleUrinalCount;
    if (men > 0) chips.push({ label: `남 ${men}` });
    if (t.femaleStallCount > 0) chips.push({ label: `여 ${t.femaleStallCount}` });
    const accessible =
        t.maleAccessibleStallCount + t.maleAccessibleUrinalCount + t.femaleAccessibleStallCount;
    if (accessible > 0) chips.push({ label: `장애인 ${accessible}` });
    const child =
        t.maleChildStallCount + t.maleChildUrinalCount + t.femaleChildStallCount;
    if (child > 0) chips.push({ label: `어린이 ${child}` });
    return chips;
}
