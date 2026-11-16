import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "../components/CopyButton";
import { useLocation, useNavigate } from "react-router-dom";
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
    Snackbar,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    useMediaQuery,
} from "@mui/material";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { computeStraightRoute, fetchNearbyToilets, fetchRecommendedToilets, haversineMeters, searchToilets, SEARCH_PAGE } from "../api";
import { SearchResults } from "../components/SearchResults";
import { SearchField } from "../components/SearchField";
import type { LatLng, ToiletNear } from "../api";
import { MapView } from "../components/MapView";
import { BoardRowContent } from "../components/BoardRow";
import CloseIcon from "@mui/icons-material/Close";
import IosShareIcon from "@mui/icons-material/IosShare";
import { ShareSheet } from "../components/ShareSheet";
import { toiletShareUrl } from "../lib/share";
import NavigationIcon from "@mui/icons-material/NavigationOutlined";
import { ToiletInteractions } from "../components/ToiletInteractions";
import { ToiletList } from "../components/ToiletList";
import { RecommendedList } from "../components/RecommendedList";
import { ClusterList } from "../components/ClusterList";
import type { ClusterSort } from "../lib/mapCluster";
import { ChangeRequestKind, DEFAULT_SEARCH_RADIUS, SearchRadius, ViewMode } from "../lib/enums";
import { FilterSheet } from "../components/FilterSheet";
import { EMPTY_FILTER, activeFilterCount, applyFilter } from "../lib/toiletFilter";
import type { ToiletFilter } from "../lib/toiletFilter";
import TuneIcon from "@mui/icons-material/Tune";

import { MOCK_USER_LOCATION, USE_MOCK } from "../mock/flag";
import { getCurrentPosition, isApp, LocationError, openAppSettings } from "../lib/nativeBridge";
import { KakaoDirectionsButton } from "../components/KakaoDirections";
import { friendlyError } from "../lib/friendlyError";
import { formatDistance } from "../i18n";
import { toiletKindLabel } from "../lib/facilityChips";
import type { LocationFailure } from "../lib/nativeBridge";
import { walkGuidePath } from "../lib/walkGuide";
import type { WalkGuideState } from "../lib/walkGuide";

const SEOUL_CITY_HALL: LatLng = { lat: 37.5666, lng: 126.9784 };

/**
 * 탭을 옮기거나 상세에서 돌아와도 홈을 처음부터 다시 시작하지 않도록, 이 세션 동안의 홈 상태를 기억한다
 * (위치, 반경, 조건, 지도/목록). 위치는 LOCATION_FRESH_MS 가 지나면 뒤에서 조용히 다시 잰다.
 */
const LOCATION_FRESH_MS = 2 * 60_000;
/** 기기가 기억하는 위치를 이 시간 안의 것이면 먼저 쓴다 (그 뒤 정확한 위치로 고침) */
const QUICK_LOCATION_MAX_AGE_MS = 10 * 60_000;
/** 정확히 다시 잰 위치가 이만큼 이상 달라야 지도를 옮긴다 (그 아래는 측정 오차) */
const LOCATION_MOVE_THRESHOLD_M = 30;
const homeMemory: {
    center: LatLng | null;
    userLocation: LatLng | null;
    locatedAt: number;
    geoFailure: LocationFailure | null;
    radiusM: SearchRadius;
    filter: ToiletFilter;
    viewMode: ViewMode;
    clusterSort: ClusterSort;
} = {
    center: null,
    userLocation: null,
    locatedAt: 0,
    geoFailure: null,
    radiusM: DEFAULT_SEARCH_RADIUS,
    filter: EMPTY_FILTER,
    viewMode: ViewMode.Map,
    clusterSort: "distance",
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
    // 지도에서 겹친 마커 묶음을 눌렀을 때의 목록
    const [clusterItems, setClusterItems] = useState<ToiletNear[] | null>(null);
    const [clusterSort, setClusterSort] = useState<ClusterSort>(homeMemory.clusterSort);
    const clusterRef = useRef<HTMLElement | null>(null);
    const scrollToCluster = useRef(false);
    const [shareOpen, setShareOpen] = useState(false);
    // 다른 화면이 넘겨 준 한 번짜리 안내 (예: 회원 탈퇴 뒤)
    const routerLocation = useLocation();
    const [notice, setNotice] = useState<string | null>((routerLocation.state as { notice?: string } | null)?.notice ?? null);
    // 위치를 못 받았을 때 이유 — 문장은 렌더 시 번역 (언어를 바꿔도 따라감)
    const [geoFailure, setGeoFailure] = useState<LocationFailure | null>(homeMemory.geoFailure);

    const [radiusM, setRadiusM] = useState<SearchRadius>(homeMemory.radiusM);
    const [filter, setFilter] = useState<ToiletFilter>(homeMemory.filter);
    // 이름·주소 검색 (MAP-06): 두 글자부터, 입력이 잠시 멈추면 찾는다. 검색 중에는 목록 자리에 결과가 나온다
    // 입력 중인 글자는 SearchField 안에만 있고, 여기에는 정해진 검색어만 온다 (타자마다 지도·목록을 다시 그리지 않게)
    const [searchTerm, setSearchTerm] = useState("");
    // 결과는 SEARCH_PAGE(20)건씩 쪽으로 나눠 보여 준다. 좌우로 밀거나 쪽 단추로 넘긴다
    const [searchPage, setSearchPage] = useState(0);
    // 위치는 검색어를 칠 때의 것만 쓴다 — 쪽을 넘겨도 같은 기준으로 이어지게 (지도를 움직여도 다시 찾지 않음)
    const [searchOrigin, setSearchOrigin] = useState<LatLng | null>(null);
    // SearchField 는 onSearch 가 바뀌면 다시 부르므로 함수를 고정하고, 검색어가 실제로 바뀔 때만 첫 쪽으로 되돌린다
    const searchOriginNow = useRef<LatLng | null>(null);
    searchOriginNow.current = userLocation ?? center;
    const lastTerm = useRef("");
    const startSearch = useCallback((term: string) => {
        if (term === lastTerm.current) return;
        lastTerm.current = term;
        setSearchTerm(term);
        setSearchPage(0);
        setSearchOrigin(searchOriginNow.current);
    }, []);
    const search = useQuery({
        queryKey: ["toilets", "search", searchTerm, searchPage],
        queryFn: () => searchToilets(searchTerm, searchOrigin, searchPage * SEARCH_PAGE),
        enabled: searchTerm !== "",
        staleTime: 60_000,
        // 다음 쪽을 받는 동안 지금 쪽을 그대로 둔다 (목록이 비었다 차는 깜빡임 없이)
        placeholderData: keepPreviousData,
    });
    const searchTotal = search.data?.total;
    const searchPageCount = searchTotal != null ? Math.max(1, Math.ceil(searchTotal / SEARCH_PAGE)) : 1;
    const [sheetOpen, setSheetOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>(homeMemory.viewMode);

    // 바뀔 때마다 기억 (다음에 홈으로 돌아왔을 때 그대로 시작)
    useEffect(() => {
        Object.assign(homeMemory, { center, userLocation, geoFailure, radiusM, filter, viewMode, clusterSort });
    }, [center, userLocation, geoFailure, radiusM, filter, viewMode, clusterSort]);

    useEffect(() => {
        if (USE_MOCK) {
            setCenter(MOCK_USER_LOCATION);
            setUserLocation(MOCK_USER_LOCATION);
            return;
        }
        // 이 세션에서 이미 잰 위치가 아직 새것이면 다시 재지 않는다
        if (homeMemory.center && Date.now() - homeMemory.locatedAt < LOCATION_FRESH_MS) return;
        const hadCenter = homeMemory.center !== null;
        // 앱이면 브리지로 네이티브 위치 (권한 요청 포함), 브라우저면 navigator.geolocation
        let cancelled = false;
        // 사용자가 지도를 다른 곳으로 옮겨 검색했으면 그 중심은 그대로 두고 내 위치 점만 옮긴다
        const apply = (here: LatLng, first: boolean) => {
            setCenter((c) => (!c || (first && !hadCenter) || sameLatLng(c, homeMemory.userLocation) ? here : c));
            setUserLocation(here);
        };
        // 1단계: 기기가 기억하는 최근 위치(10분 안)면 GPS 를 기다리지 않고 바로 지도를 그린다.
        // 2단계: 그 위치가 기억값이었으면 뒤에서 정확히 다시 재고, 의미 있게 달라졌을 때만 옮긴다.
        getCurrentPosition({ enableHighAccuracy: false, timeout: 8_000, maximumAge: QUICK_LOCATION_MAX_AGE_MS })
            .then((first) => {
                if (cancelled) return;
                const here = { lat: first.lat, lng: first.lng };
                homeMemory.locatedAt = Date.now();
                setGeoFailure(null);
                apply(here, true);
                if (!first.cached) return;
                getCurrentPosition({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 })
                    .then((precise) => {
                        if (cancelled) return;
                        const p = { lat: precise.lat, lng: precise.lng };
                        if (haversineMeters(here, p) < LOCATION_MOVE_THRESHOLD_M) return;
                        homeMemory.locatedAt = Date.now();
                        apply(p, false);
                    })
                    .catch(() => undefined); // 기억값이라도 보여 주고 있으니 조용히 둔다
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

    // 추천: 추천 보기를 열었을 때만 받는다. 조건(필터)은 근처 목록과 같게 적용
    const recQuery = useQuery({
        enabled: center !== null && viewMode === ViewMode.Recommended,
        queryKey: ["toilets", "recommended", center?.lat, center?.lng, radiusM],
        queryFn: () => fetchRecommendedToilets(center!.lat, center!.lng, radiusM),
    });
    const recommended = useMemo(() => {
        if (!recQuery.data) return undefined;
        const allowed = new Set(applyFilter(recQuery.data.map((r) => r.toilet), filter).map((t) => t.id));
        return recQuery.data.filter((r) => allowed.has(r.toilet.id));
    }, [recQuery.data, filter]);

    // 지도 가운데가 내 위치인가 (거리를 "내 위치에서"로 말할 수 있는가)
    const centeredOnMe = sameLatLng(userLocation, center);

    /** 상세 화면으로 — 거리 계산 기준점과 그 기준이 "내 위치"인지 함께 넘긴다 */
    const openDetail = (toilet: ToiletNear) => {
        navigate(`/toilets/${toilet.id}`, { state: { origin: center, fromMe: centeredOnMe } });
    };
    const activeFilters = activeFilterCount(filter);
    // 넓은 화면에서는 지도가 늘 오른쪽에 있으므로 왼쪽 패널은 목록이나 추천 (지도 보기는 목록으로 본다)
    const wide = useMediaQuery("(min-width: 64rem)");
    const panelMode = wide && viewMode === ViewMode.Map ? ViewMode.List : viewMode;
    /** 넓은 화면의 목록에서 고르면 상세로 가지 않고 지도에서 고른다 (지도와 카드가 함께 보이므로) */
    const selectOnMap = (toilet: ToiletNear) => {
        scrollToCard.current = true;
        setSelectedToilet(toilet);
    };

    // 묶음 목록이 그려진 뒤 그리로 스크롤
    useEffect(() => {
        if (!scrollToCluster.current || !clusterItems) return;
        scrollToCluster.current = false;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        clusterRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }, [clusterItems]);

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

    // 제목 · 알림 · 필터와 보기 전환
    const header = (
        <>
        <Typography variant="h4" component="h1">{t("home.title")}</Typography>
        {geoFailure && (
            <Alert
                severity="info"
                action={
                    // "다시 묻지 않음"이면 앱이 권한을 다시 물을 수 없으니 설정 앱으로 보낸다 (APP-02)
                    geoFailure === "deniedForever" && isApp() ? (
                        <Button color="inherit" size="small" onClick={() => void openAppSettings()}>
                            {t("home.openSettings")}
                        </Button>
                    ) : undefined
                }
            >
                {t("home.geoFallback", { reason: t(`location.${geoFailure}`) })}
            </Alert>
        )}
        {query.isError && (
            <Alert
                severity="error"
                action={
                    <Button color="inherit" size="small" onClick={() => void query.refetch()} disabled={query.isFetching}>
                        {t("common.retry")}
                    </Button>
                }
            >
                {friendlyError(query.error, t("home.loadFailed"))}
            </Alert>
        )}

        <SearchField onSearch={startSearch} />
        <Snackbar open={notice !== null} autoHideDuration={4000} onClose={() => setNotice(null)} message={notice} />

        {/* === 필터 버튼 + 지도/목록 전환 === */}
        <Stack direction="row" spacing={1} alignItems="center">
            <Button
                variant={activeFilters > 0 ? "contained" : "outlined"}
                color="secondary"
                onClick={() => setSheetOpen(true)}
                startIcon={<TuneIcon />}
                sx={{ minHeight: 40 }}
            >
                {/* 글자 "필터"는 아이콘이 대신한다. 화면 낭독기에는 "필터 500m" 로 읽힌다 */}
                <span className="visually-hidden">{t("filter.button")} </span>
                {formatDistance(radiusM, true)}
                {activeFilters > 0 && (
                    <Box component="span" sx={{ ml: 1 }}>
                        {t("filter.activeCount", { count: activeFilters })}
                    </Box>
                )}
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <ToggleButtonGroup
                size="small"
                exclusive
                value={panelMode}
                onChange={(_, v: ViewMode | null) => v && setViewMode(v)}
                aria-label={t("home.viewToggle")}
            >
                {!wide && <ToggleButton value={ViewMode.Map}>{t("home.viewMap")}</ToggleButton>}
                <ToggleButton value={ViewMode.List}>{t("home.viewList")}</ToggleButton>
                <ToggleButton value={ViewMode.Recommended}>{t("home.viewRecommended")}</ToggleButton>
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

        </>
    );

    const mapView = (
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
                setClusterItems(null);
            }}
            onSelectToilet={(t) => {
                scrollToCard.current = true;
                setClusterItems(null);
                setSelectedToilet(t);
            }}
            onSelectCluster={(items) => {
                scrollToCluster.current = true;
                setSelectedToilet(null);
                setRouting(false);
                setClusterItems(items);
            }}
            userLocation={userLocation}
            routeFrom={route ? userLocation : null}
            routeTo={
                route && selectedToilet?.latitude != null && selectedToilet.longitude != null
                    ? { lat: selectedToilet.latitude, lng: selectedToilet.longitude }
                    : null
            }
        />
    );

    // 목록 또는 추천
    const results = searchTerm !== "" ? (
        <SearchResults
            results={search.data?.items}
            total={searchTotal}
            loading={search.isPending}
            failed={search.isError}
            page={searchPage}
            pageCount={searchPageCount}
            pageLoading={search.isPlaceholderData}
            onPage={(p) => setSearchPage(Math.min(Math.max(p, 0), searchPageCount - 1))}
            origin={userLocation ?? center}
            onSelect={(r) => navigate(`/toilets/${r.id}`)}
        />
    ) : (
        <>
        {/* 불러오기에 실패했으면 "조건에 맞는 화장실이 없어요" 대신 위의 오류 안내만 (받아 둔 목록이 있으면 그대로) */}
        {panelMode === ViewMode.List && !(query.isError && !query.data) && (
            <ToiletList
                toilets={filteredToilets}
                totalBeforeFilter={query.data?.length}
                selectedId={selectedToilet?.id ?? null}
                onSelect={wide ? selectOnMap : openDetail}
            />
        )}

        {panelMode === ViewMode.Recommended && (
            <RecommendedList
                items={recommended}
                loading={recQuery.isLoading}
                failed={recQuery.isError}
                onSelect={wide ? selectOnMap : openDetail}
                onShowList={() => setViewMode(ViewMode.List)}
            />
        )}

        </>
    );

    // 고른 화장실 카드와 평점·댓글
    const selection = (
        <>
        {/* === 겹친 마커 묶음 목록 === */}
        {clusterItems && (
            <ClusterList
                ref={clusterRef}
                items={clusterItems}
                sort={clusterSort}
                onSortChange={setClusterSort}
                radiusM={radiusM}
                onSelect={(t) => {
                    scrollToCard.current = true;
                    setClusterItems(null);
                    setSelectedToilet(t);
                }}
                onClose={() => setClusterItems(null)}
            />
        )}
        {/* === 선택 화장실 카드 === */}
        {selectedToilet && (
            <Card variant="outlined" ref={cardRef} sx={{ scrollMarginTop: "var(--space-md)" }}>
                <CardContent sx={{ pt: 1, pb: 2 }}>
                    {/* 머리 줄은 목록의 안내판 행과 같은 모양: 거리, 이름과 시설, 오른쪽 끝 상태 */}
                    {/* 도구 줄: 왼쪽에 무엇을 보고 있는지, 오른쪽에 공유·닫기. 안내판 행은 그 아래 카드 폭 그대로
                        (닫기를 행 옆에 두면 상태 칸이 가운데로 밀리고 아래 선이 닫기 앞에서 끊긴다) */}
                    <Stack direction="row" alignItems="center" sx={{ mr: -1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                            {t("home.selectedLabel")}
                        </Typography>
                        <IconButton aria-label={t("detail.share")} onClick={() => setShareOpen(true)} sx={{ width: 44, height: 44 }}>
                            <IosShareIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            aria-label={t("common.close")}
                            onClick={() => {
                                setSelectedToilet(null);
                                setRouting(false);
                            }}
                            sx={{ width: 44, height: 44 }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                    <Box className="board-row is-static">
                        <BoardRowContent toilet={selectedToilet} facilities="detailed" />
                    </Box>

                    {/* 사실 목록: 머리카락 선으로 나눈 2열 */}
                    <Box component="dl" className="facts" sx={{ mt: 1 }}>
                        <dt>{t("home.factKind")}</dt>
                        <dd>{toiletKindLabel(t, selectedToilet.kind)}</dd>
                        <dt>{t("home.factDistance")}</dt>
                        <dd>
                            {t(centeredOnMe ? "home.fromMe" : "home.fromMapCenter", {
                                distance: formatDistance(selectedToilet.distanceM),
                            })}
                        </dd>
                        {(selectedToilet.roadAddress || selectedToilet.lotAddress) && (
                            <>
                                <dt>{t("home.factAddress")}</dt>
                                <dd>
                                    {selectedToilet.roadAddress ?? selectedToilet.lotAddress}
                                    <CopyButton text={(selectedToilet.roadAddress ?? selectedToilet.lotAddress)!} what={t("copy.address")} />
                                </dd>
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
                                    <CopyButton text={selectedToilet.phone} what={t("copy.phone")} />
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
                            // 누르면 도보 / 차 고르기
                            <KakaoDirectionsButton
                                variant="contained"
                                size="large"
                                fullWidth
                                dest={{ name: selectedToilet.name, lat: selectedToilet.latitude, lng: selectedToilet.longitude }}
                                from={userLocation}
                            >
                                {t("home.kakaoDirections")}
                            </KakaoDirectionsButton>
                        )}
                        {selectedToilet.latitude != null && selectedToilet.longitude != null && (
                            // 앱 안에서 일직선 방향과 남은 거리를 따라가며 보여 준다 (실제 길은 카카오맵)
                            <Button
                                variant="outlined"
                                fullWidth
                                startIcon={<NavigationIcon />}
                                onClick={() =>
                                    navigate(walkGuidePath(selectedToilet.id), {
                                        state: {
                                            name: selectedToilet.name,
                                            lat: selectedToilet.latitude!,
                                            lng: selectedToilet.longitude!,
                                        } satisfies WalkGuideState,
                                    })
                                }
                            >
                                {t("guide.start")}
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
                                        kind: ChangeRequestKind.Edit,
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
            <ShareSheet
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                payload={{
                    title: selectedToilet.name,
                    url: toiletShareUrl(selectedToilet.id),
                    description: toiletKindLabel(t, selectedToilet.kind),
                    address: selectedToilet.roadAddress ?? selectedToilet.lotAddress ?? undefined,
                }}
            />
        )}

        {selectedToilet && (
            <ToiletInteractions
                toiletId={selectedToilet.id}
                averageRating={selectedToilet.averageRating}
                ratingCount={selectedToilet.ratingCount}
            />
        )}

        </>
    );

    // dev 전용 디버그 줄
    const debug = (
        <>
        {/* === 상태 표시 (dev 전용 디버그 줄, 주소에 ?debug 를 붙였을 때만) === */}
        {import.meta.env.DEV && !USE_MOCK && new URLSearchParams(window.location.search).has("debug") && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                center=({center?.lat.toFixed(5)}, {center?.lng.toFixed(5)}) status={query.status}
                {" "}{filteredToilets.length}/{query.data?.length ?? 0}
                {activeFilters > 0 && ` filter=${JSON.stringify(filter)}`}
                {query.isFetching && " fetching"}
            </Typography>
        )}
        </>
    );

    // 넓은 화면(64rem~): 왼쪽 패널(제목·필터·고른 곳·목록)과 오른쪽 지도를 나란히. 지도는 화면 높이를 채운 채 붙어 있다
    if (wide) {
        return (
            <Box className="home-split">
                <Stack spacing={2} className="home-panel">
                    {header}
                    {selection}
                    {results}
                    {debug}
                </Stack>
                <Box className="home-map">{mapView}</Box>
            </Box>
        );
    }

    return (
        <Stack spacing={2}>
            {header}
            {viewMode === ViewMode.Map && mapView}
            {results}
            {selection}
            {debug}
        </Stack>
    );
}

function sameLatLng(a: LatLng | null, b: LatLng | null) {
    return !!a && !!b && a.lat === b.lat && a.lng === b.lng;
}
