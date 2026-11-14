import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import {
    Alert,
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    Chip,
    MenuItem,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { computeStraightRoute, fetchNearbyToilets } from "../api";
import type { LatLng, ToiletNear } from "../api";
import { MapView } from "../components/MapView";
import { StatusTile } from "../components/OpenStatusBadge";
import { fonts } from "../design/tokens";
import { ToiletInteractions } from "../components/ToiletInteractions";
import { ToiletList } from "../components/ToiletList";
import {
    ChangeRequestKind,
    DEFAULT_SEARCH_RADIUS,
    FACILITY_FILTER_OPTIONS,
    FacilityFilter,
    SEARCH_RADIUS_OPTIONS,
    SearchRadius,
    ViewMode,
} from "../lib/enums";

import { MOCK_USER_LOCATION, USE_MOCK } from "../mock/flag";
import { getCurrentPosition, isApp, LocationError, openDirectionsInApp } from "../lib/nativeBridge";
import { friendlyError } from "../lib/friendlyError";
import { parseOpenStatus } from "../lib/openStatus";
import { formatDistance } from "../i18n";
import { facilityChipLabels, toiletKindLabel } from "../lib/facilityChips";
import type { LocationFailure } from "../lib/nativeBridge";

const SEOUL_CITY_HALL: LatLng = { lat: 37.5666, lng: 126.9784 };

export function HomePage() {
    const auth = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [center, setCenter] = useState<LatLng | null>(null);
    const [userLocation, setUserLocation] = useState<LatLng | null>(null);
    // 클릭 시점의 스냅샷 — 표시용 값은 아래에서 최신 /near 응답으로 다시 풀어 씀 (평점 등록 후 평균 갱신).
    const [pickedToilet, setSelectedToilet] = useState<ToiletNear | null>(null);
    const [routing, setRouting] = useState(false);
    // 위치를 못 받았을 때 이유 — 문장은 렌더 시 번역 (언어를 바꿔도 따라감)
    const [geoFailure, setGeoFailure] = useState<LocationFailure | null>(null);

    const [radiusM, setRadiusM] = useState<SearchRadius>(DEFAULT_SEARCH_RADIUS);
    const [facilityFilters, setFacilityFilters] = useState<FacilityFilter[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Map);

    useEffect(() => {
        if (USE_MOCK) {
            setCenter(MOCK_USER_LOCATION);
            setUserLocation(MOCK_USER_LOCATION);
            return;
        }
        // 앱이면 브리지로 네이티브 GPS (권한 요청 포함), 브라우저면 navigator.geolocation
        let cancelled = false;
        getCurrentPosition({ enableHighAccuracy: false, timeout: 5_000, maximumAge: 60_000 })
            .then(({ lat, lng }) => {
                if (cancelled) return;
                const here = { lat, lng };
                setCenter(here);
                setUserLocation(here);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setCenter(SEOUL_CITY_HALL);
                setGeoFailure(err instanceof LocationError ? err.reason : "failed");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const query = useQuery({
        enabled: center !== null,
        queryKey: ["toilets", "near", center?.lat, center?.lng, radiusM],
        queryFn: () => fetchNearbyToilets(center!.lat, center!.lng, radiusM),
    });

    const selectedToilet = useMemo<ToiletNear | null>(() => {
        if (!pickedToilet) return null;
        return query.data?.find((t) => t.id === pickedToilet.id) ?? pickedToilet;
    }, [pickedToilet, query.data]);

    const filteredToilets = useMemo(() => {
        const list = query.data ?? [];
        return list.filter((t) => {
            for (const f of facilityFilters) {
                if (!facilityMatch(t, f)) return false;
            }
            return true;
        });
    }, [query.data, facilityFilters]);

    const route = useMemo(() => {
        if (!routing || !userLocation || !selectedToilet) return null;
        if (selectedToilet.latitude == null || selectedToilet.longitude == null) return null;
        return computeStraightRoute(userLocation, {
            lat: selectedToilet.latitude,
            lng: selectedToilet.longitude,
        });
    }, [routing, userLocation, selectedToilet]);

    return (
        <Stack spacing={2}>
            <Typography variant="h4">{t("home.title")}</Typography>
            {geoFailure && (
                <Alert severity="info">{t("home.geoFallback", { reason: t(`location.${geoFailure}`) })}</Alert>
            )}
            {query.isError && (
                <Alert severity="error">
                    {friendlyError(query.error, t("home.loadFailed"))}
                </Alert>
            )}

            {/* === 필터 패널 === */}
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ xs: "stretch", sm: "center" }}
                sx={{ flexWrap: "wrap" }}
                useFlexGap
            >
                <TextField
                    select
                    size="small"
                    label={t("home.radius")}
                    value={radiusM}
                    onChange={(e) => setRadiusM(Number(e.target.value) as SearchRadius)}
                    sx={{ minWidth: 130 }}
                >
                    {SEARCH_RADIUS_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                </TextField>

                <ToggleButtonGroup
                    size="small"
                    value={facilityFilters}
                    onChange={(_, v: FacilityFilter[]) => setFacilityFilters(v)}
                    aria-label={t("home.facilityFilter")}
                    // 시안처럼 칸마다 떨어진 타일 (붙은 버튼 그룹 대신)
                    sx={{
                        flexWrap: "wrap",
                        gap: 0.75,
                        "& .MuiToggleButtonGroup-grouped": {
                            border: "1px solid",
                            borderColor: "mashil.line",
                            borderRadius: "6px !important",
                            ml: "0 !important",
                            px: 1.5,
                        },
                    }}
                >
                    {FACILITY_FILTER_OPTIONS.map((f) => (
                        <ToggleButton key={f} value={f}>{t(`facility.filter.${f}`)}</ToggleButton>
                    ))}
                </ToggleButtonGroup>

                <Box sx={{ flexGrow: 1 }} />

                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={viewMode}
                    onChange={(_, v: ViewMode | null) => v && setViewMode(v)}
                    aria-label={t("home.viewToggle")}
                >
                    <ToggleButton value={ViewMode.Map}>{t("home.viewMap")}</ToggleButton>
                    <ToggleButton value={ViewMode.List}>{t("home.viewList")}</ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            {/* === 지도 또는 목록 === */}
            {center && viewMode === ViewMode.Map && (
                <MapView
                    center={center}
                    radiusM={radiusM}
                    toilets={filteredToilets}
                    selectedId={selectedToilet?.id ?? null}
                    onSearchAtCenter={(c) => {
                        setCenter(c);
                        // 새 영역으로 이동했으면 이전 선택은 컨텍스트가 어긋나므로 자동 해제
                        setSelectedToilet(null);
                        setRouting(false);
                    }}
                    onSelectToilet={(t) => setSelectedToilet(t)}
                    userLocation={userLocation}
                    routeFrom={route ? userLocation : null}
                    routeTo={
                        route && selectedToilet?.latitude != null && selectedToilet.longitude != null
                            ? { lat: selectedToilet.latitude, lng: selectedToilet.longitude }
                            : null
                    }
                />
            )}
            {viewMode === ViewMode.List && (
                <ToiletList
                    toilets={filteredToilets}
                    totalBeforeFilter={query.data?.length}
                    selectedId={selectedToilet?.id ?? null}
                    onSelect={(t) => setSelectedToilet(t)}
                />
            )}

            {/* === 선택 화장실 카드 === */}
            {selectedToilet && (
                <Card variant="outlined">
                    <CardContent sx={{ pb: 1 }}>
                        {/* 정보 위계: 거리 숫자 → 이름 → 상태 → 시설. 거리 타일과 상태 타일을 나란히. */}
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, mb: 1.5 }}>
                            <Box
                                sx={{
                                    border: "1.5px solid",
                                    borderColor: "mashil.line",
                                    bgcolor: "mashil.bg",
                                    borderRadius: 1,
                                    p: 1.5,
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    gap: 0.5,
                                }}
                            >
                                <Box component="span" sx={{ fontFamily: fonts.mono, fontSize: 30, lineHeight: 1 }}>
                                    {formatDistance(selectedToilet.distanceM, true)}
                                </Box>
                                <Box component="span" sx={{ fontSize: 12, color: "text.secondary" }}>
                                    {t(
                                        userLocation && center && userLocation.lat === center.lat && userLocation.lng === center.lng
                                            ? "home.distanceFromMe"
                                            : "home.distanceFromCenter",
                                    )}
                                </Box>
                            </Box>
                            <StatusTile openHours={selectedToilet.openHours} openHoursDetail={selectedToilet.openHoursDetail} />
                        </Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.35 }}>
                            {selectedToilet.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {toiletKindLabel(t, selectedToilet.kind)}
                        </Typography>
                        {(selectedToilet.roadAddress || selectedToilet.lotAddress) && (
                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                {selectedToilet.roadAddress ?? selectedToilet.lotAddress}
                            </Typography>
                        )}

                        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} useFlexGap flexWrap="wrap" alignItems="center">
                            {facilityChipLabels(t, selectedToilet, "detailed").map((label) => (
                                <Chip key={label} size="small" label={label} variant="outlined" />
                            ))}
                        </Stack>

                        {(selectedToilet.openHours || selectedToilet.openHoursDetail) && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                                {t("home.listedHours", {
                                    hours: [selectedToilet.openHours, selectedToilet.openHoursDetail]
                                        .filter(Boolean)
                                        .join(" · "),
                                })}
                            </Typography>
                        )}
                        {selectedToilet.phone && (
                            <Typography variant="body2">
                                <b>{t("home.phone")}</b> <a href={`tel:${selectedToilet.phone}`}>{selectedToilet.phone}</a>
                            </Typography>
                        )}

                        {route && (
                            <Alert severity="success" sx={{ mt: 1.5 }} icon={false}>
                                <Stack spacing={0.5}>
                                    <Typography variant="body2">
                                        <Trans
                                            i18nKey="home.routeSummary"
                                            values={{ distance: formatDistance(route.distanceM), minutes: route.walkingMinutes }}
                                            components={{ b: <b /> }}
                                        />
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t("home.routeNote")}
                                    </Typography>
                                </Stack>
                            </Alert>
                        )}
                    </CardContent>
                    <CardActions
                        disableSpacing
                        // disableSpacing: MUI 기본 selector 비활성화.
                        //   기본은 `& > :not(:first-of-type) { ml: 1 }` 인데, "카카오맵에서 길찾기"
                        //   버튼이 `component="a"` 로 <a> 가 되면서 다른 <button> 들과 element type 이
                        //   섞여 first-of-type 평가가 종류별로 따로 일어나 간격이 어긋남.
                        // 대신 flex `gap` 으로 element type 무관 균일 간격.
                        sx={{
                            gap: 1,
                            flexWrap: "wrap",
                            flexDirection: { xs: "column", sm: "row" },
                            alignItems: { xs: "stretch", sm: "center" },
                        }}
                    >
                        {userLocation ? (
                            <Button size="small" color="secondary" onClick={() => setRouting((v) => !v)}>
                                {routing ? t("home.hideDistance") : t("home.showDistance")}
                            </Button>
                        ) : (
                            <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                                {t("home.distanceNeedsLocation")}
                            </Typography>
                        )}
                        {selectedToilet.latitude != null && selectedToilet.longitude != null && (
                            <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                component="a"
                                href={buildKakaoMapRouteUrl(selectedToilet, userLocation, t("home.myLocation"))}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e: React.MouseEvent) => {
                                    // 앱 웹뷰는 target=_blank 를 열지 못함 → 브리지로 카카오맵 앱(없으면 웹) 길찾기
                                    const t = selectedToilet;
                                    if (!isApp() || t.latitude == null || t.longitude == null) return;
                                    e.preventDefault();
                                    void openDirectionsInApp(t.latitude, t.longitude, t.name);
                                }}
                            >
                                {t("home.kakaoDirections")}
                            </Button>
                        )}
                        {auth.user && (
                            <>
                                <Button
                                    size="small"
                                    color="secondary"
                                    onClick={() => navigate("/change-requests/new", {
                                        state: {
                                            kind: ChangeRequestKind.Update,
                                            targetToiletId: selectedToilet.id,
                                            targetName: selectedToilet.name,
                                        },
                                    })}
                                >
                                    {t("home.fixInfo")}
                                </Button>
                                <Button
                                    size="small"
                                    color="secondary"
                                    onClick={() => navigate("/change-requests/new", {
                                        state: {
                                            kind: ChangeRequestKind.Delete,
                                            targetToiletId: selectedToilet.id,
                                            targetName: selectedToilet.name,
                                        },
                                    })}
                                >
                                    {t("home.reportGone")}
                                </Button>
                            </>
                        )}
                        <Button
                            size="small"
                            color="secondary"
                            onClick={() => {
                                setSelectedToilet(null);
                                setRouting(false);
                            }}
                        >
                            {t("common.close")}
                        </Button>
                    </CardActions>
                </Card>
            )}

            {selectedToilet && (
                <ToiletInteractions
                    toiletId={selectedToilet.id}
                    averageRating={selectedToilet.averageRating}
                />
            )}

            {/* === 상태 표시 (dev 전용 디버그 줄, 주소에 ?debug 를 붙였을 때만) === */}
            {import.meta.env.DEV && !USE_MOCK && new URLSearchParams(window.location.search).has("debug") && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                    center=({center?.lat.toFixed(5)}, {center?.lng.toFixed(5)}) · status={query.status}
                    {" · "}{filteredToilets.length}/{query.data?.length ?? 0} 곳
                    {facilityFilters.length > 0 && ` · 필터: ${facilityFilters.join(",")}`}
                    {query.isFetching && " · 갱신 중…"}
                </Typography>
            )}
        </Stack>
    );
}

function facilityMatch(t: ToiletNear, key: FacilityFilter): boolean {
    switch (key) {
        case FacilityFilter.Men:
            return t.maleStallCount + t.maleUrinalCount > 0;
        case FacilityFilter.Women:
            return t.femaleStallCount > 0;
        case FacilityFilter.Accessible:
            return (
                t.maleAccessibleStallCount + t.maleAccessibleUrinalCount + t.femaleAccessibleStallCount
                > 0
            );
        case FacilityFilter.Child:
            return t.maleChildStallCount + t.maleChildUrinalCount + t.femaleChildStallCount > 0;
        case FacilityFilter.Open: {
            const kind = parseOpenStatus(t.openHours, t.openHoursDetail).kind;
            return kind === "open" || kind === "24h";
        }
    }
}

function buildKakaoMapRouteUrl(
    toilet: { name: string; latitude: number | null; longitude: number | null },
    user: LatLng | null,
    myLocationLabel: string,
): string {
    if (toilet.latitude == null || toilet.longitude == null) return "https://map.kakao.com/";
    const eName = encodeURIComponent(toilet.name);
    const eLat = toilet.latitude;
    const eLng = toilet.longitude;
    if (user) {
        const sName = encodeURIComponent(myLocationLabel);
        return `https://map.kakao.com/link/from/${sName},${user.lat},${user.lng}/to/${eName},${eLat},${eLng}`;
    }
    return `https://map.kakao.com/link/to/${eName},${eLat},${eLng}`;
}
