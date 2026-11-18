import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { bottomNavHeight } from "./BottomNav";
import { useMapRelayout } from "../lib/layout";
import { Alert, Box, Button, IconButton, Popover, Stack, Typography, useMediaQuery } from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useTranslation } from "react-i18next";
import { tileStateOf } from "../design/statusTile";
import { MARKER_SIZE, createClusterButton, createMarkerButton } from "../lib/mapMarker";
import { darkMirror, lightMirror } from "../design/tokens";
import { loadKakaoMaps } from "../lib/kakaoMap";
import { groupOverlapping } from "../lib/mapCluster";
import type { PinBox } from "../lib/mapCluster";
import { statusOf } from "../lib/openStatus";
import type { LatLng as Coord, ToiletNear } from "../api";
import { openStatusLabel } from "./OpenStatusBadge";

interface Props {
    /** null = still finding the user's location (the box shows the locating step) */
    center: Coord | null;
    /** the nearby query has no data yet */
    loadingPlaces?: boolean;
    radiusM: number;
    toilets: ToiletNear[];
    selectedId: number | null;
    onSearchAtCenter: (center: Coord) => void;
    onSelectToilet: (t: ToiletNear) => void;
    /** 겹쳐서 하나로 묶인 마커를 눌렀을 때 (묶인 화장실들) */
    onSelectCluster?: (toilets: ToiletNear[]) => void;
    /** 내 위치 (있으면 점으로 표시) */
    userLocation?: Coord | null;
    /** 거리 표시선의 출발점. null 이면 선을 그리지 않음. */
    routeFrom: Coord | null;
    /** 거리 표시선의 도착점 (보통 선택된 화장실 좌표). null 이면 선을 그리지 않음. */
    routeTo: Coord | null;
}

interface Pin {
    overlay: kakao.maps.CustomOverlay;
    el: HTMLButtonElement;
    toiletId: number;
    toilet: ToiletNear;
    /** 화면에 그려진 크기 (px). 묶여 숨겨져 있으면 잴 수 없으니 처음 잰 값을 둔다 */
    size: { width: number; height: number } | null;
}

/** 아직 못 잰 마커의 크기 (핀 모양) */
const PIN_FALLBACK = MARKER_SIZE;

/** 지도 아래에 남겨 둘 여백 (px). 하단 탭(없으면 화면 아래)과 지도 테두리 사이.
 *  App 의 Container 아래 여백(py: 3 = 24px, --space-lg)과 같아야 페이지가 화면보다 길어지지 않는다 */
const MAP_BOTTOM_GAP = 24;
/** 이보다 작게는 줄이지 않는다 (가로 화면, 아주 작은 창) */
const MAP_MIN_HEIGHT = 320;

/**
 * Kakao 지도 + 검색 반경 원 + 상태 안내판 조각 마커 (docs/07-ui-design.md, Wayfind).
 * 지도 칸은 화면 높이에 맞춘다: 지도가 시작하는 위치부터 화면 아래까지. "이 지역에서 다시 검색"은 지도 위 아래쪽에 띄운다.
 */
export function MapView({
    center,
    radiusM,
    toilets,
    selectedId,
    onSearchAtCenter,
    onSelectToilet,
    onSelectCluster,
    userLocation,
    routeFrom,
    routeTo,
    loadingPlaces = false,
}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<kakao.maps.Map | null>(null);
    const pinsRef = useRef<Pin[]>([]);
    const radiusCircleRef = useRef<kakao.maps.Circle | null>(null);
    const routeLineRef = useRef<kakao.maps.Polyline | null>(null);
    const meRef = useRef<kakao.maps.CustomOverlay | null>(null);
    const clusterOverlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
    const selectedIdRef = useRef(selectedId);
    selectedIdRef.current = selectedId;
    const onSelectClusterRef = useRef(onSelectCluster);
    useEffect(() => {
        onSelectClusterRef.current = onSelectCluster;
    }, [onSelectCluster]);
    // 부모가 매 렌더마다 새 화살표 함수를 넘겨도 마커를 다시 그리지 않도록 최신 콜백은 ref 로 읽는다
    const onSelectRef = useRef(onSelectToilet);
    useEffect(() => {
        onSelectRef.current = onSelectToilet;
    }, [onSelectToilet]);

    const { t } = useTranslation();
    // Kakao 의 원·선은 SVG 속성이라 CSS 변수를 못 받는다 → 현재 모드의 실제 색값을 넘긴다.
    const dark = useMediaQuery("(prefers-color-scheme: dark)");
    const tokens = dark ? darkMirror : lightMirror;
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    // the first full set of map tiles has been drawn (Kakao 'tilesloaded')
    const [tilesLoaded, setTilesLoaded] = useState(false);
    const [height, setHeight] = useState<number>(MAP_MIN_HEIGHT);

    // 0) 지도 칸 높이 = 화면 높이 - 지도가 문서에서 시작하는 위치 - 아래 여백. 창 크기·회전이 바뀌면 다시 잰다
    useLayoutEffect(() => {
        const measure = () => {
            const el = containerRef.current;
            if (!el) return;
            const top = el.getBoundingClientRect().top + window.scrollY;
            const viewport = window.visualViewport?.height ?? window.innerHeight;
            // 하단 탭이 있으면 그 높이만큼 뺀다 (지도가 탭 아래로 들어가지 않게)
            // 가로 폰처럼 화면이 낮으면 최소 높이도 화면 안에 들어오게 줄인다
            const min = Math.min(MAP_MIN_HEIGHT, Math.round(viewport - 2 * MAP_BOTTOM_GAP));
            setHeight(Math.max(min, Math.round(viewport - top - MAP_BOTTOM_GAP - bottomNavHeight())));
        };
        measure();
        window.addEventListener("resize", measure);
        window.visualViewport?.addEventListener("resize", measure);
        return () => {
            window.removeEventListener("resize", measure);
            window.visualViewport?.removeEventListener("resize", measure);
        };
    }, []);

    // 0a) 폭만 바뀌어도 (회전, 레일, 분할 화면) 다시 그린다
    useMapRelayout(containerRef, () => mapRef.current);

    // 0b) 칸 크기가 바뀌면 Kakao 지도에 알려 다시 그리게 한다 (안 하면 빈 타일이 남는다)
    useEffect(() => {
        if (!ready || !mapRef.current || !center) return;
        mapRef.current.relayout();
        mapRef.current.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, height]);

    // 1a) start loading the SDK right away, while the location is still being found
    useEffect(() => {
        loadKakaoMaps().catch(() => undefined);
    }, []);

    // 1) map and radius circle, once the first center is known
    const hasCenter = center !== null;
    useEffect(() => {
        if (!hasCenter || mapRef.current) return;
        let cancelled = false;
        loadKakaoMaps()
            .then((maps) => {
                if (cancelled || !containerRef.current || !center) return;
                const initialLatLng = new maps.LatLng(center.lat, center.lng);
                const map = new maps.Map(containerRef.current, {
                    center: initialLatLng,
                    level: levelForRadius(radiusM),
                });
                mapRef.current = map;
                radiusCircleRef.current = new maps.Circle({
                    center: initialLatLng,
                    radius: radiusM,
                    strokeWeight: 2,
                    strokeColor: tokens.accent,
                    strokeOpacity: 0.9,
                    strokeStyle: "shortdash",
                    fillColor: tokens.accent,
                    fillOpacity: 0.06,
                });
                radiusCircleRef.current.setMap(map);
                maps.event.addListener(map, "tilesloaded", () => setTilesLoaded(true));
                // 줌·이동이 멈출 때마다 겹친 마커를 다시 묶는다
                maps.event.addListener(map, "idle", () => regroupRef.current());
                setReady(true);
            })
            .catch((e: Error) => !cancelled && setError(e.message));
        return () => {
            cancelled = true;
        };
        // only the first center / radiusM; later changes go through the effects below
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasCenter]);

    // 1b) 라이트·다크 전환 시 원 색 갱신
    useEffect(() => {
        radiusCircleRef.current?.setOptions({ strokeColor: tokens.accent, fillColor: tokens.accent });
    }, [ready, tokens.accent]);

    // 2) center prop 변경 시 지도 중심 + 반경 원 위치 이동
    useEffect(() => {
        if (!ready || !mapRef.current || !center) return;
        const latlng = new window.kakao.maps.LatLng(center.lat, center.lng);
        mapRef.current.setCenter(latlng);
        radiusCircleRef.current?.setPosition(latlng);
    }, [ready, center?.lat, center?.lng]);

    // 2b) radiusM 변경 시 반경 원 크기 + 줌 레벨 동기 — 원이 viewport 에 들어오게.
    useEffect(() => {
        if (!ready) return;
        radiusCircleRef.current?.setRadius(radiusM);
        mapRef.current?.setLevel(levelForRadius(radiusM));
    }, [ready, radiusM]);

    // 2c) 내 위치 점
    useEffect(() => {
        if (!ready || !mapRef.current) return;
        meRef.current?.setMap(null);
        meRef.current = null;
        if (!userLocation) return;
        const maps = window.kakao.maps;
        const dot = document.createElement("div");
        dot.setAttribute("aria-hidden", "true");
        dot.className = "me-dot";
        const me = new maps.CustomOverlay({
            position: new maps.LatLng(userLocation.lat, userLocation.lng),
            content: dot,
            xAnchor: 0.5,
            yAnchor: 0.5,
            zIndex: 5,
        });
        me.setMap(mapRef.current);
        meRef.current = me;
    }, [ready, userLocation?.lat, userLocation?.lng]);

    // 3) toilets 변경 시 상태 타일 마커 다시 그리기
    useEffect(() => {
        if (!ready || !mapRef.current) return;
        const map = mapRef.current;
        const maps = window.kakao.maps;

        pinsRef.current.forEach((p) => p.overlay.setMap(null));
        const next: Pin[] = [];
        for (const toilet of toilets) {
            if (toilet.latitude == null || toilet.longitude == null) continue;
            const status = statusOf(toilet);
            // 글자 없는 핀: 상태는 모양과 색으로, 이름과 상태는 화면 낭독기에
            const el = createMarkerButton(tileStateOf(status));
            el.setAttribute("aria-label", `${toilet.name}, ${openStatusLabel(t, status, "full")}`);
            el.addEventListener("click", () => onSelectRef.current(toilet));
            const overlay = new maps.CustomOverlay({
                position: new maps.LatLng(toilet.latitude, toilet.longitude),
                content: el,
                xAnchor: 0.5,
                yAnchor: 1,
                zIndex: 10,
                clickable: true,
            });
            overlay.setMap(map);
            next.push({ overlay, el, toiletId: toilet.id, toilet, size: null });
        }
        pinsRef.current = next;
        regroupRef.current();
    }, [ready, toilets, t]);

    // 3a) 겹친 마커 묶기. 고른 화장실은 묶지 않고 늘 따로 보인다
    const regroupRef = useRef<() => void>(() => undefined);
    regroupRef.current = () => {
        const map = mapRef.current;
        if (!ready || !map) return;
        const maps = window.kakao.maps;
        clusterOverlaysRef.current.forEach((o) => o.setMap(null));
        clusterOverlaysRef.current = [];

        const projection = map.getProjection();
        const pins = pinsRef.current;
        const free: Pin[] = [];
        for (const p of pins) {
            if (p.toiletId === selectedIdRef.current) p.overlay.setMap(map);
            else free.push(p);
        }
        const boxes: PinBox[] = free.map((p) => {
            if (!p.size && p.el.offsetWidth > 0) p.size = { width: p.el.offsetWidth, height: p.el.offsetHeight };
            const pt = projection.containerPointFromCoords(p.overlay.getPosition());
            return { x: pt.x, y: pt.y, ...(p.size ?? PIN_FALLBACK) };
        });
        for (const group of groupOverlapping(boxes)) {
            const members = group.map((i) => free[i]);
            if (members.length === 1) {
                members[0].overlay.setMap(map);
                continue;
            }
            members.forEach((m) => m.overlay.setMap(null));
            const lat = members.reduce((s, m) => s + m.overlay.getPosition().getLat(), 0) / members.length;
            const lng = members.reduce((s, m) => s + m.overlay.getPosition().getLng(), 0) / members.length;
            const toiletsInGroup = members.map((m) => m.toilet);
            const el = createClusterButton(members.length);
            el.setAttribute("aria-label", t("cluster.pinAria", { count: members.length }));
            el.addEventListener("click", () => onSelectClusterRef.current?.(toiletsInGroup));
            const overlay = new maps.CustomOverlay({
                position: new maps.LatLng(lat, lng),
                content: el,
                xAnchor: 0.5,
                yAnchor: 0.5,
                zIndex: 20,
                clickable: true,
            });
            overlay.setMap(map);
            clusterOverlaysRef.current.push(overlay);
        }
    };

    // 3b) 선택된 마커: 먹색 외곽선 + 위로 (선택은 색이 아니라 외곽선으로 표시)
    useEffect(() => {
        if (!ready) return;
        for (const { overlay, el, toiletId } of pinsRef.current) {
            const selected = toiletId === selectedId;
            el.setAttribute("aria-pressed", String(selected));
            overlay.setZIndex(selected ? 100 : 10);
            // 목록에서 고른 곳이 지금 보이는 범위 밖이면 그쪽으로 옮긴다 (넓은 화면에서 목록과 지도를 함께 볼 때)
            const map = mapRef.current;
            if (selected && map && !map.getBounds().contain(overlay.getPosition())) map.panTo(overlay.getPosition());
        }
        regroupRef.current();
    }, [ready, selectedId, toilets]);

    // 4) 거리 표시선 — routeFrom + routeTo 둘 다 있을 때만
    useEffect(() => {
        if (!ready) return;
        const maps = window.kakao.maps;
        routeLineRef.current?.setMap(null);
        routeLineRef.current = null;
        if (!routeFrom || !routeTo || !mapRef.current) return;
        const line = new maps.Polyline({
            path: [new maps.LatLng(routeFrom.lat, routeFrom.lng), new maps.LatLng(routeTo.lat, routeTo.lng)],
            strokeWeight: 3,
            strokeColor: tokens.ink,
            strokeOpacity: 0.9,
            strokeStyle: "shortdash",
        });
        line.setMap(mapRef.current);
        routeLineRef.current = line;
    }, [ready, routeFrom?.lat, routeFrom?.lng, routeTo?.lat, routeTo?.lng, tokens.ink]);

    return (
        <Stack spacing={1}>
            <Box sx={{ position: "relative" }}>
                <Box
                    ref={containerRef}
                    sx={{
                        width: "100%",
                        height,
                        overflow: "hidden",
                        border: "var(--rule-bar) solid var(--color-ink)",
                        bgcolor: "var(--color-paper-2)",
                    }}
                />
                {/* loading steps as they really happen: locating, then the map, then the places */}
                {!error && (!center || !ready || !tilesLoaded) && (
                    <div className="map-loading">
                        <MapLoadingPlate label={!center ? t("map.locating") : t("map.loading")} />
                    </div>
                )}
                {!error && center && ready && tilesLoaded && loadingPlaces && (
                    <div className="map-loading is-floating">
                        <MapLoadingPlate label={t("map.findingPlaces")} />
                    </div>
                )}
                {/* 핀 모양 설명: 지도 왼쪽 위 "?" 단추를 누르면 펼친다 (늘 띄워 두면 지도를 가린다) */}
                {ready && <MarkerHelp />}
                {ready && (
                    // 지도 위 아래쪽에 띄워 지도가 화면 높이를 다 쓰게 한다
                    <Button
                        variant="outlined"
                        onClick={() => {
                            const c = mapRef.current!.getCenter();
                            onSearchAtCenter({ lat: c.getLat(), lng: c.getLng() });
                        }}
                        sx={{
                            position: "absolute",
                            left: "50%",
                            bottom: 16,
                            transform: "translateX(-50%)",
                            zIndex: 2,
                            bgcolor: "var(--color-paper-3)",
                            "&:hover": { bgcolor: "var(--color-paper-2)" },
                            "&:active": { transform: "translateX(-50%) translateY(1px)" },
                        }}
                    >
                        {t("map.searchHere")}
                    </Button>
                )}
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
        </Stack>
    );
}

/** a signage plate with three cells that fill one at a time (departure-board stiff, still under reduced motion) */
function MapLoadingPlate({ label }: { label: string }) {
    return (
        <div className="loading-plate" role="status" aria-live="polite">
            <span className="loading-cells" aria-hidden="true">
                <span />
                <span />
                <span />
            </span>
            <span>{label}</span>
        </div>
    );
}

/** "?" 단추와 핀 모양 설명 */
function MarkerHelp() {
    const { t } = useTranslation();
    const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
    return (
        <>
            <IconButton
                aria-label={t("map.legend.button")}
                aria-expanded={anchor !== null}
                aria-haspopup="dialog"
                onClick={(e) => setAnchor(e.currentTarget)}
                sx={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    zIndex: 2,
                    width: 40,
                    height: 40,
                    // 반투명: 지도를 덜 가리게
                    bgcolor: "color-mix(in srgb, var(--color-paper-3) 70%, transparent)",
                    color: "var(--color-ink)",
                    border: "var(--rule-bar) solid color-mix(in srgb, var(--color-ink) 60%, transparent)",
                    backdropFilter: "blur(2px)",
                    "&:hover": { bgcolor: "color-mix(in srgb, var(--color-paper-2) 85%, transparent)" },
                }}
            >
                <HelpOutlineIcon fontSize="small" />
            </IconButton>
            <Popover
                open={anchor !== null}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{
                    paper: {
                        role: "dialog",
                        "aria-labelledby": "marker-help-title",
                        sx: { mt: 0.5, p: 1.5, border: "var(--rule-bar) solid var(--color-ink)", borderRadius: 0 },
                    },
                }}
            >
                <Typography id="marker-help-title" component="h2" sx={{ fontWeight: 800, mb: 1 }}>
                    {t("map.legend.label")}
                </Typography>
                <MarkerLegend />
            </Popover>
        </>
    );
}

/** 핀 모양 설명 목록: 글자 없는 핀이 무슨 뜻인지 */
function MarkerLegend() {
    const { t } = useTranslation();
    const items = [
        { state: "live", label: t("map.legend.open") },
        { state: "soon", label: t("map.legend.soon") },
        { state: "closed", label: t("map.legend.closed") },
        { state: "unknown", label: t("map.legend.unknown") },
    ] as const;
    return (
        <ul className="marker-legend">
            {items.map((i) => (
                <li key={i.state}>
                    <span className={`marker marker--${i.state} is-static is-mini`} aria-hidden="true">
                        <svg viewBox="0 0 28 36" width="14" height="18">
                            <path d="M14 1C6.8 1 1 6.6 1 13.6 1 23.2 14 35 14 35s13-11.8 13-21.4C27 6.6 21.2 1 14 1z" className="marker-body" />
                        </svg>
                    </span>
                    {i.label}
                </li>
            ))}
            <li>
                <span className="marker-cluster is-mini" aria-hidden="true">
                    2
                </span>
                {t("map.legend.cluster")}
            </li>
        </ul>
    );
}

/**
 * 반경(미터) → Kakao 지도 줌 레벨. 작을수록 확대.
 * Kakao 레벨별 대략 가시 폭: L5 ~1km · L6 ~2km · L7 ~5km · L8 ~10km · L9 ~20km.
 */
function levelForRadius(radiusM: number): number {
    if (radiusM <= 500) return 5;
    if (radiusM <= 1000) return 6;
    if (radiusM <= 3000) return 7;
    if (radiusM <= 5000) return 8;
    return 9; // 10km+
}
