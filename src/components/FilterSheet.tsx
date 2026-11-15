import { useEffect, useMemo, useState } from "react";
import { Box, Button, ButtonBase, Drawer, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchNearbyToilets } from "../api";
import type { LatLng } from "../api";
import { SEARCH_RADIUS_OPTIONS, SearchRadius } from "../lib/enums";
import type { FacilityFilter } from "../lib/enums";
import { EMPTY_FILTER, FACILITY_TILE_OPTIONS, KIND_FILTER_OPTIONS, applyFilter } from "../lib/toiletFilter";
import type { KindFilter, OpenFilter, ToiletFilter } from "../lib/toiletFilter";

interface Props {
    open: boolean;
    onClose: () => void;
    center: LatLng | null;
    filter: ToiletFilter;
    radiusM: SearchRadius;
    onApply: (filter: ToiletFilter, radiusM: SearchRadius) => void;
}

/** 시트의 반경 세그먼트 (5개) — 10km 는 목록이 너무 길어져 시트에서는 뺀다 */
const SHEET_RADII = SEARCH_RADIUS_OPTIONS.filter((o) => o.value <= SearchRadius.R5km);

/**
 * 필터 시트 (docs/07-ui-design.md §7): 개방 상태 · 시설 2×2 · 검색 반경 · 구분.
 * 하단 "N곳 보기"는 고르는 동안 결과 수를 바로 반영한다 (반경을 바꾸면 그 반경으로 미리 조회).
 */
export function FilterSheet({ open, onClose, center, filter, radiusM, onApply }: Props) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<ToiletFilter>(filter);
    const [draftRadius, setDraftRadius] = useState<SearchRadius>(radiusM);

    // 열 때마다 현재 적용된 값에서 시작
    useEffect(() => {
        if (open) {
            setDraft(filter);
            setDraftRadius(radiusM);
        }
    }, [open, filter, radiusM]);

    // 홈 화면과 같은 쿼리 키 → 같은 반경이면 캐시를 그대로 쓴다
    const preview = useQuery({
        enabled: open && center !== null,
        queryKey: ["toilets", "near", center?.lat, center?.lng, draftRadius],
        queryFn: () => fetchNearbyToilets(center!.lat, center!.lng, draftRadius),
    });
    const count = useMemo(() => (preview.data ? applyFilter(preview.data, draft).length : null), [preview.data, draft]);

    const toggleFacility = (f: FacilityFilter) =>
        setDraft((d) => ({
            ...d,
            facilities: d.facilities.includes(f) ? d.facilities.filter((x) => x !== f) : [...d.facilities, f],
        }));
    const toggleKind = (k: KindFilter) =>
        setDraft((d) => ({ ...d, kinds: d.kinds.includes(k) ? d.kinds.filter((x) => x !== k) : [...d.kinds, k] }));

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            slotProps={{
                paper: {
                    sx: {
                        maxWidth: 640,
                        mx: "auto",
                        maxHeight: "90vh",
                    },
                },
            }}
        >
            <Box sx={{ px: 2, pt: 1.25, pb: 2, display: "flex", flexDirection: "column", gap: 2.25, overflowY: "auto" }}>
                <Typography component="h2" variant="h6">
                    {t("filter.title")}
                </Typography>

                <Section label={t("filter.openStatus")}>
                    <ToggleButtonGroup
                        exclusive
                        fullWidth
                        value={draft.open}
                        onChange={(_, v: OpenFilter | null) => v && setDraft((d) => ({ ...d, open: v }))}
                        aria-label={t("filter.openStatus")}
                    >
                        <ToggleButton value="all">{t("filter.openAll")}</ToggleButton>
                        <ToggleButton value="open">{t("filter.openNow")}</ToggleButton>
                        <ToggleButton value="always">{t("filter.openAlways")}</ToggleButton>
                    </ToggleButtonGroup>
                </Section>

                <Section label={t("filter.facilities")}>
                    <Box role="group" aria-label={t("filter.facilities")} sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                        {FACILITY_TILE_OPTIONS.map((f) => {
                            const on = draft.facilities.includes(f);
                            return (
                                <ButtonBase
                                    key={f}
                                    aria-pressed={on}
                                    onClick={() => toggleFacility(f)}
                                    sx={{
                                        height: 56,
                                        border: "var(--rule-bar) solid var(--color-ink)",
                                        bgcolor: on ? "var(--color-ink)" : "var(--color-paper-3)",
                                        color: on ? "var(--color-paper)" : "var(--color-ink)",
                                        fontWeight: on ? 800 : 500,
                                        fontSize: "var(--text-md)",
                                        "&:hover": { bgcolor: on ? "var(--color-ink)" : "var(--color-paper-2)" },
                                        "&:focus-visible": { outline: "2px solid var(--color-focus)", outlineOffset: 2 },
                                    }}
                                >
                                    {t(`facility.filter.${f}`)}
                                </ButtonBase>
                            );
                        })}
                    </Box>
                </Section>

                <Section label={t("filter.radius")}>
                    <ToggleButtonGroup
                        exclusive
                        fullWidth
                        value={draftRadius}
                        onChange={(_, v: SearchRadius | null) => v && setDraftRadius(v)}
                        aria-label={t("filter.radius")}
                    >
                        {SHEET_RADII.map((o) => (
                            <ToggleButton key={o.value} value={o.value} sx={{ px: 0.5 }}>
                                {o.label.replace(" ", "")}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                </Section>

                <Section label={t("filter.kind")} hint={t("filter.kindHint")}>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                        {KIND_FILTER_OPTIONS.map((k) => {
                            const on = draft.kinds.includes(k);
                            return (
                                <ToggleButton key={k} value={k} selected={on} onChange={() => toggleKind(k)} size="small" sx={{ px: 1.5 }}>
                                    {t(`filter.kinds.${k}`)}
                                </ToggleButton>
                            );
                        })}
                    </Stack>
                </Section>

                <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
                    <Button
                        color="secondary"
                        variant="outlined"
                        sx={{ minHeight: 52, px: 2.5, flexShrink: 0, whiteSpace: "nowrap" }}
                        onClick={() => {
                            setDraft(EMPTY_FILTER);
                            setDraftRadius(radiusM);
                        }}
                    >
                        {t("filter.reset")}
                    </Button>
                    <Button
                        variant="contained"
                        fullWidth
                        sx={{ minHeight: 52, fontSize: 16 }}
                        onClick={() => {
                            onApply(draft, draftRadius);
                            onClose();
                        }}
                    >
                        {count === null ? t("filter.counting") : t("filter.show", { count })}
                    </Button>
                </Stack>
            </Box>
        </Drawer>
    );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {label}
                </Typography>
                {hint && (
                    <Typography variant="caption" color="text.secondary">
                        {hint}
                    </Typography>
                )}
            </Box>
            {children}
        </Box>
    );
}
