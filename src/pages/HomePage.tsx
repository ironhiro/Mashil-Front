import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { OpenStatusBadge } from "../components/OpenStatusBadge";
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

const SEOUL_CITY_HALL: LatLng = { lat: 37.5666, lng: 126.9784 };

export function HomePage() {
    const auth = useAuth();
    const navigate = useNavigate();
    const [center, setCenter] = useState<LatLng | null>(null);
    const [userLocation, setUserLocation] = useState<LatLng | null>(null);
    const [selectedToilet, setSelectedToilet] = useState<ToiletNear | null>(null);
    const [routing, setRouting] = useState(false);
    const [geoNote, setGeoNote] = useState<string | null>(null);

    const [radiusM, setRadiusM] = useState<SearchRadius>(DEFAULT_SEARCH_RADIUS);
    const [facilityFilters, setFacilityFilters] = useState<FacilityFilter[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Map);

    useEffect(() => {
        if (!navigator.geolocation) {
            setCenter(SEOUL_CITY_HALL);
            setGeoNote("이 브라우저는 위치 권한을 지원하지 않아 서울시청을 기준으로 표시합니다. 길찾기는 비활성화됩니다.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCenter(here);
                setUserLocation(here);
            },
            () => {
                setCenter(SEOUL_CITY_HALL);
                setGeoNote("위치 권한이 없어 서울시청을 기준으로 표시합니다. 길찾기는 비활성화됩니다.");
            },
            { enableHighAccuracy: false, timeout: 5_000, maximumAge: 60_000 },
        );
    }, []);

    const query = useQuery({
        enabled: center !== null,
        queryKey: ["toilets", "near", center?.lat, center?.lng, radiusM],
        queryFn: () => fetchNearbyToilets(center!.lat, center!.lng, radiusM),
    });

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
            <Typography variant="h4">내 주변 화장실</Typography>
            {geoNote && <Alert severity="info">{geoNote}</Alert>}
            {query.isError && (
                <Alert severity="error">백엔드 호출 실패: {(query.error as Error).message}</Alert>
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
                    label="검색 반경"
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
                    aria-label="시설 필터"
                >
                    {FACILITY_FILTER_OPTIONS.map((o) => (
                        <ToggleButton key={o.value} value={o.value}>{o.label}</ToggleButton>
                    ))}
                </ToggleButtonGroup>

                <Box sx={{ flexGrow: 1 }} />

                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={viewMode}
                    onChange={(_, v: ViewMode | null) => v && setViewMode(v)}
                    aria-label="뷰 전환"
                >
                    <ToggleButton value={ViewMode.Map}>지도</ToggleButton>
                    <ToggleButton value={ViewMode.List}>목록</ToggleButton>
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
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {selectedToilet.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {selectedToilet.kind} · 검색 중심에서 {Math.round(selectedToilet.distanceM)} m
                        </Typography>
                        {(selectedToilet.roadAddress || selectedToilet.lotAddress) && (
                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                {selectedToilet.roadAddress ?? selectedToilet.lotAddress}
                            </Typography>
                        )}

                        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} useFlexGap flexWrap="wrap" alignItems="center">
                            <OpenStatusBadge
                                openHours={selectedToilet.openHours}
                                openHoursDetail={selectedToilet.openHoursDetail}
                            />
                            {facilityChipsFor(selectedToilet).map((c) => (
                                <Chip key={c.label} size="small" label={c.label} />
                            ))}
                        </Stack>

                        {(selectedToilet.openHours || selectedToilet.openHoursDetail) && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                                원본 표기: {selectedToilet.openHours ?? ""}
                                {selectedToilet.openHours && selectedToilet.openHoursDetail && " · "}
                                {selectedToilet.openHoursDetail ?? ""}
                            </Typography>
                        )}
                        {selectedToilet.phone && (
                            <Typography variant="body2">
                                <b>전화</b> <a href={`tel:${selectedToilet.phone}`}>{selectedToilet.phone}</a>
                            </Typography>
                        )}

                        {route && (
                            <Alert severity="success" sx={{ mt: 1.5 }} icon={false}>
                                <Stack spacing={0.5}>
                                    <Typography variant="body2">
                                        직선 거리 <b>{Math.round(route.distanceM)} m</b> · 도보 약 <b>{route.walkingMinutes} 분</b>
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        실제 보행 경로는 다를 수 있어요 (현재는 직선 안내).
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
                            <Button size="small" onClick={() => setRouting((v) => !v)}>
                                {routing ? "직선 끄기" : "직선 보기"}
                            </Button>
                        ) : (
                            <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                                직선 안내는 위치 권한 필요
                            </Typography>
                        )}
                        {selectedToilet.latitude != null && selectedToilet.longitude != null && (
                            <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                component="a"
                                href={buildKakaoMapRouteUrl(selectedToilet, userLocation)}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                카카오맵에서 길찾기 ↗
                            </Button>
                        )}
                        {auth.user && (
                            <>
                                <Button
                                    size="small"
                                    onClick={() => navigate("/change-requests/new", {
                                        state: {
                                            kind: ChangeRequestKind.Update,
                                            targetToiletId: selectedToilet.id,
                                            targetName: selectedToilet.name,
                                        },
                                    })}
                                >
                                    수정 요청
                                </Button>
                                <Button
                                    size="small"
                                    color="error"
                                    onClick={() => navigate("/change-requests/new", {
                                        state: {
                                            kind: ChangeRequestKind.Delete,
                                            targetToiletId: selectedToilet.id,
                                            targetName: selectedToilet.name,
                                        },
                                    })}
                                >
                                    삭제 요청
                                </Button>
                            </>
                        )}
                        <Button
                            size="small"
                            onClick={() => {
                                setSelectedToilet(null);
                                setRouting(false);
                            }}
                        >
                            선택 해제
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

            {/* === 상태 표시 (dev 전용 디버그 줄) === */}
            {import.meta.env.DEV && (
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
    }
}

interface FacilityChipInfo {
    label: string;
}

function facilityChipsFor(t: ToiletNear): FacilityChipInfo[] {
    const out: FacilityChipInfo[] = [];
    const men = t.maleStallCount + t.maleUrinalCount;
    if (men > 0) out.push({ label: `남 ${men} (대 ${t.maleStallCount}/소 ${t.maleUrinalCount})` });
    if (t.femaleStallCount > 0) out.push({ label: `여 ${t.femaleStallCount}` });
    const acc = t.maleAccessibleStallCount + t.maleAccessibleUrinalCount + t.femaleAccessibleStallCount;
    if (acc > 0) out.push({ label: `장애인 ${acc}` });
    const child = t.maleChildStallCount + t.maleChildUrinalCount + t.femaleChildStallCount;
    if (child > 0) out.push({ label: `어린이 ${child}` });
    return out;
}

function buildKakaoMapRouteUrl(
    toilet: { name: string; latitude: number | null; longitude: number | null },
    user: LatLng | null,
): string {
    if (toilet.latitude == null || toilet.longitude == null) return "https://map.kakao.com/";
    const eName = encodeURIComponent(toilet.name);
    const eLat = toilet.latitude;
    const eLng = toilet.longitude;
    if (user) {
        const sName = encodeURIComponent("내 위치");
        return `https://map.kakao.com/link/from/${sName},${user.lat},${user.lng}/to/${eName},${eLat},${eLng}`;
    }
    return `https://map.kakao.com/link/to/${eName},${eLat},${eLng}`;
}
