import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    IconButton,
    Link,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { computeStraightRoute, fetchNearbyToilets } from "../api";
import type { LatLng, ToiletNear } from "../api";
import { MapView } from "../components/MapView";
import { BoardRowContent } from "../components/BoardRow";
import CloseIcon from "@mui/icons-material/Close";
import { ToiletInteractions } from "../components/ToiletInteractions";
import { ToiletList } from "../components/ToiletList";
import { ChangeRequestKind, DEFAULT_SEARCH_RADIUS, SearchRadius, ViewMode } from "../lib/enums";
import { FilterSheet } from "../components/FilterSheet";
import { EMPTY_FILTER, activeFilterCount, applyFilter } from "../lib/toiletFilter";
import type { ToiletFilter } from "../lib/toiletFilter";
import TuneIcon from "@mui/icons-material/Tune";

import { MOCK_USER_LOCATION, USE_MOCK } from "../mock/flag";
import { getCurrentPosition, isApp, LocationError, openDirectionsInApp } from "../lib/nativeBridge";
import { friendlyError } from "../lib/friendlyError";
import { formatDistance } from "../i18n";
import { toiletKindLabel } from "../lib/facilityChips";
import type { LocationFailure } from "../lib/nativeBridge";

const SEOUL_CITY_HALL: LatLng = { lat: 37.5666, lng: 126.9784 };

/**
 * 탭을 옮기거나 상세에서 돌아와도 홈을 처음부터 다시 시작하지 않도록, 이 세션 동안의 홈 상태를 기억한다
 * (위치, 반경, 조건, 지도/목록). 위치는 LOCATION_FRESH_MS 가 지나면 뒤에서 조용히 다시 잰다.
 */
const LOCATION_FRESH_MS = 2 * 60_000;
const homeMemory: {
    center: LatLng | null;
    userLocation: LatLng | null;
    locatedAt: number;
    geoFailure: LocationFailure | null;
    radiusM: SearchRadius;
    filter: ToiletFilter;
    viewMode: ViewMode;
} = {
    center: null,
    userLocation: null,
    locatedAt: 0,
    geoFailure: null,
    radiusM: DEFAULT_SEARCH_RADIUS,
    filter: EMPTY_FILTER,
    viewMode: ViewMode.Map,
};

export function HomePage() {
    const auth = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [center, setCenter] = useState<LatLng | null>(homeMemory.center);
    const [userLocation, setUserLocation] = useState<LatLng | null>(homeMemory.userLocation);
    // 클릭 시점의 스냅샷 — 표시용 값은 아래에서 최신 /near 응답으로 다시 풀어 씀 (평점 등록 후 평균 갱신).
    const [pickedToilet, setSelectedToilet] = useState<ToiletNear | null>(null);
    const cardRef = useRef<HTMLDivElement | null>(null);
    // 지도에서 마커를 누르면 그 장소의 카드로 스크롤 (목록에서는 바로 상세로 가므로 해당 없음)
    const scrollToCard = useRef(false);
    const [routing, setRouting] = useState(false);
    // 위치를 못 받았을 때 이유 — 문장은 렌더 시 번역 (언어를 바꿔도 따라감)
    const [geoFailure, setGeoFailure] = useState<LocationFailure | null>(homeMemory.geoFailure);

    const [radiusM, setRadiusM] = useState<SearchRadius>(homeMemory.radiusM);
    const [filter, setFilter] = useState<ToiletFilter>(homeMemory.filter);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>(homeMemory.viewMode);

    // 바뀔 때마다 기억 (다음에 홈으로 돌아왔을 때 그대로 시작)
    useEffect(() => {
        Object.assign(homeMemory, { center, userLocation, geoFailure, radiusM, filter, viewMode });
    }, [center, userLocation, geoFailure, radiusM, filter, viewMode]);

    useEffect(() => {
        if (USE_MOCK) {
            setCenter(MOCK_USER_LOCATION);
            setUserLocation(MOCK_USER_LOCATION);
            return;
        }
        // 이 세션에서 이미 잰 위치가 아직 새것이면 다시 재지 않는다
        if (homeMemory.center && Date.now() - homeMemory.locatedAt < LOCATION_FRESH_MS) return;
        const hadCenter = homeMemory.center !== null;
        // 앱이면 브리지로 네이티브 GPS (권한 요청 포함), 브라우저면 navigator.geolocation
        let cancelled = false;
        getCurrentPosition({ enableHighAccuracy: false, timeout: 5_000, maximumAge: 60_000 })
            .then(({ lat, lng }) => {
                if (cancelled) return;
                const here = { lat, lng };
                homeMemory.locatedAt = Date.now();
                setGeoFailure(null);
                // 다시 잰 경우: 사용자가 지도를 다른 곳으로 옮겨 검색했으면 그 중심은 그대로 둔다
                setCenter((c) => (!c || !hadCenter || sameLatLng(c, homeMemory.userLocation) ? here : c));
                setUserLocation(here);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                if (hadCenter) return; // 다시 재기 실패: 보고 있던 화면을 그대로 둔다
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
        return applyFilter(query.data ?? [], filter);
    }, [query.data, filter]);

    /** 상세 화면으로 — 거리 계산 기준점과 그 기준이 "내 위치"인지 함께 넘긴다 */
    const openDetail = (toilet: ToiletNear) => {
        const fromMe = !!userLocation && !!center && userLocation.lat === center.lat && userLocation.lng === center.lng;
        navigate(`/toilets/${toilet.id}`, { state: { origin: center, fromMe } });
    };
    const activeFilters = activeFilterCount(filter);

    // 카드가 그려진 뒤 스크롤. 동작 줄이기 설정이면 부드러운 스크롤 없이 바로
    useEffect(() => {
        if (!scrollToCard.current || !pickedToilet) return;
        scrollToCard.current = false;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        cardRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }, [pickedToilet]);

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

            {/* === 필터 버튼 + 지도/목록 전환 === */}
            <Stack direction="row" spacing={1} alignItems="center">
                <Button
                    variant={activeFilters > 0 ? "contained" : "outlined"}
                    color="secondary"
                    onClick={() => setSheetOpen(true)}
                    startIcon={<TuneIcon />}
                    sx={{ minHeight: 40 }}
                >
                    {t("filter.button")}
                    {activeFilters > 0 && ` ${activeFilters}`}
                    <Box component="span" sx={{ ml: 1, fontWeight: 500 }}>
                        {formatDistance(radiusM, true)}
                    </Box>
                </Button>
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
            <FilterSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                center={center}
                filter={filter}
                radiusM={radiusM}
                onApply={(f, r) => {
                    setFilter(f);
                    setRadiusM(r);
                }}
            />

            {/* === 지도 또는 목록 === */}
            {viewMode === ViewMode.Map && (
                <MapView
                    center={center}
                    loadingPlaces={query.isLoading}
                    radiusM={radiusM}
                    toilets={filteredToilets}
                    selectedId={selectedToilet?.id ?? null}
                    onSearchAtCenter={(c) => {
                        setCenter(c);
                        // 새 영역으로 이동했으면 이전 선택은 컨텍스트가 어긋나므로 자동 해제
                        setSelectedToilet(null);
                        setRouting(false);
                    }}
                    onSelectToilet={(t) => {
                        scrollToCard.current = true;
                        setSelectedToilet(t);
                    }}
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
                    onSelect={openDetail}
                />
            )}

            {/* === 선택 화장실 카드 === */}
            {selectedToilet && (
                <Card variant="outlined" ref={cardRef} sx={{ scrollMarginTop: "var(--space-md)" }}>
                    <CardContent sx={{ pt: 1, pb: 2 }}>
                        {/* 머리 줄은 목록의 안내판 행과 같은 모양: 거리, 이름과 시설, 오른쪽 끝 상태 */}
                        <Stack direction="row" alignItems="flex-start" spacing={1}>
                            <Box className="board-row is-static" sx={{ flex: 1, minWidth: 0 }}>
                                <BoardRowContent toilet={selectedToilet} facilities="detailed" />
                            </Box>
                            <IconButton
                                aria-label={t("common.close")}
                                onClick={() => {
                                    setSelectedToilet(null);
                                    setRouting(false);
                                }}
                                sx={{ width: 44, height: 44, flexShrink: 0, mt: 1 }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </Stack>

                        {/* 사실 목록: 머리카락 선으로 나눈 2열 */}
                        <Box component="dl" className="facts" sx={{ mt: 1 }}>
                            <dt>{t("home.factKind")}</dt>
                            <dd>{toiletKindLabel(t, selectedToilet.kind)}</dd>
                            <dt>{t("home.factDistance")}</dt>
                            <dd>
                                {t(
                                    userLocation && center && userLocation.lat === center.lat && userLocation.lng === center.lng
                                        ? "home.fromMe"
                                        : "home.fromMapCenter",
                                    { distance: formatDistance(selectedToilet.distanceM) },
                                )}
                            </dd>
                            {(selectedToilet.roadAddress || selectedToilet.lotAddress) && (
                                <>
                                    <dt>{t("home.factAddress")}</dt>
                                    <dd>{selectedToilet.roadAddress ?? selectedToilet.lotAddress}</dd>
                                </>
                            )}
                            {(selectedToilet.openHours || selectedToilet.openHoursDetail) && (
                                <>
                                    <dt>{t("home.factHours")}</dt>
                                    <dd>{[selectedToilet.openHours, selectedToilet.openHoursDetail].filter(Boolean).join(", ")}</dd>
                                </>
                            )}
                            {selectedToilet.phone && (
                                <>
                                    <dt>{t("home.phone")}</dt>
                                    <dd>
                                        <a href={`tel:${selectedToilet.phone}`}>{selectedToilet.phone}</a>
                                    </dd>
                                </>
                            )}
                        </Box>

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
                        {/* 행동은 세 층: 주 행동(길찾기) 하나, 보조 두 칸, 글자 링크 */}
                        <Stack spacing={1} sx={{ mt: 2 }}>
                            {selectedToilet.latitude != null && selectedToilet.longitude != null && (
                                <Button
                                    variant="contained"
                                    size="large"
                                    fullWidth
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
                            <Box sx={{ display: "grid", gridTemplateColumns: userLocation ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: 1 }}>
                                <Button variant="outlined" onClick={() => openDetail(selectedToilet)}>
                                    {t("detail.more")}
                                </Button>
                                {userLocation && (
                                    <Button variant="outlined" aria-pressed={routing} onClick={() => setRouting((v) => !v)}>
                                        {routing ? t("home.hideDistance") : t("home.showDistance")}
                                    </Button>
                                )}
                            </Box>
                            {!userLocation && (
                                <Typography variant="body2" color="text.secondary">
                                    {t("home.distanceNeedsLocation")}
                                </Typography>
                            )}
                            {auth.user && (
                                <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" sx={{ pt: 0.5 }}>
                                    <Link
                                        component="button"
                                        type="button"
                                        variant="body2"
                                        onClick={() => navigate("/change-requests/new", {
                                        state: {
                                            kind: ChangeRequestKind.Update,
                                            targetToiletId: selectedToilet.id,
                                            targetName: selectedToilet.name,
                                        },
                                    })}
                                    >
                                        {t("home.fixInfo")}
                                    </Link>
                                    <Link
                                        component="button"
                                        type="button"
                                        variant="body2"
                                        onClick={() => navigate("/change-requests/new", {
                                        state: {
                                            kind: ChangeRequestKind.Delete,
                                            targetToiletId: selectedToilet.id,
                                            targetName: selectedToilet.name,
                                        },
                                    })}
                                    >
                                        {t("home.reportGone")}
                                    </Link>
                                </Stack>
                            )}
                        </Stack>
                    </CardContent>
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
                    center=({center?.lat.toFixed(5)}, {center?.lng.toFixed(5)}) status={query.status}
                    {" "}{filteredToilets.length}/{query.data?.length ?? 0}
                    {activeFilters > 0 && ` filter=${JSON.stringify(filter)}`}
                    {query.isFetching && " fetching"}
                </Typography>
            )}
        </Stack>
    );
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

function sameLatLng(a: LatLng | null, b: LatLng | null) {
    return !!a && !!b && a.lat === b.lat && a.lng === b.lng;
}
