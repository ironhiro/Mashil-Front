import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, useMediaQuery } from "@mui/material";
import { useTranslation } from "react-i18next";
import { stateClass, tileStateOf } from "../design/statusTile";
import { darkMirror, lightMirror } from "../design/tokens";
import { loadKakaoMaps } from "../lib/kakaoMap";
import { statusOf } from "../lib/openStatus";
import type { LatLng as Coord, ToiletNear } from "../api";
import { openStatusLabel } from "./OpenStatusBadge";

interface Props {
    center: Coord;
    radiusM: number;
    toilets: ToiletNear[];
    selectedId: number | null;
    onSearchAtCenter: (center: Coord) => void;
    onSelectToilet: (t: ToiletNear) => void;
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
}

/** 지도 아래에 남겨 둘 여백 (px). 화면 아래 가장자리와 지도 테두리 사이 */
const MAP_BOTTOM_GAP = 16;
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
    userLocation,
    routeFrom,
    routeTo,
}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<kakao.maps.Map | null>(null);
    const pinsRef = useRef<Pin[]>([]);
    const radiusCircleRef = useRef<kakao.maps.Circle | null>(null);
    const routeLineRef = useRef<kakao.maps.Polyline | null>(null);
    const meRef = useRef<kakao.maps.CustomOverlay | null>(null);

    const { t } = useTranslation();
    // Kakao 의 원·선은 SVG 속성이라 CSS 변수를 못 받는다 → 현재 모드의 실제 색값을 넘긴다.
    const dark = useMediaQuery("(prefers-color-scheme: dark)");
    const tokens = dark ? darkMirror : lightMirror;
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [height, setHeight] = useState<number>(MAP_MIN_HEIGHT);

    // 0) 지도 칸 높이 = 화면 높이 - 지도가 문서에서 시작하는 위치 - 아래 여백. 창 크기·회전이 바뀌면 다시 잰다
    useLayoutEffect(() => {
        const measure = () => {
            const el = containerRef.current;
            if (!el) return;
            const top = el.getBoundingClientRect().top + window.scrollY;
            const viewport = window.visualViewport?.height ?? window.innerHeight;
            setHeight(Math.max(MAP_MIN_HEIGHT, Math.round(viewport - top - MAP_BOTTOM_GAP)));
        };
        measure();
        window.addEventListener("resize", measure);
        window.visualViewport?.addEventListener("resize", measure);
        return () => {
            window.removeEventListener("resize", measure);
            window.visualViewport?.removeEventListener("resize", measure);
        };
    }, []);

    // 0b) 칸 크기가 바뀌면 Kakao 지도에 알려 다시 그리게 한다 (안 하면 빈 타일이 남는다)
    useEffect(() => {
        if (!ready || !mapRef.current) return;
        mapRef.current.relayout();
        mapRef.current.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, height]);

    // 1) SDK 로드 + 지도/반경원 초기화 (마운트 시 1회)
    useEffect(() => {
        let cancelled = false;
        loadKakaoMaps()
            .then((maps) => {
                if (cancelled || !containerRef.current) return;
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
                setReady(true);
            })
            .catch((e: Error) => !cancelled && setError(e.message));
        return () => {
            cancelled = true;
        };
        // 초기 center / radiusM 만 사용 — 이후 변경은 별도 effect 들에서.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 1b) 라이트·다크 전환 시 원 색 갱신
    useEffect(() => {
        radiusCircleRef.current?.setOptions({ strokeColor: tokens.accent, fillColor: tokens.accent });
    }, [ready, tokens.accent]);

    // 2) center prop 변경 시 지도 중심 + 반경 원 위치 이동
    useEffect(() => {
        if (!ready || !mapRef.current) return;
        const latlng = new window.kakao.maps.LatLng(center.lat, center.lng);
        mapRef.current.setCenter(latlng);
        radiusCircleRef.current?.setPosition(latlng);
    }, [ready, center.lat, center.lng]);

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
            const label = openStatusLabel(t, status, "short");
            const el = createPinElement(label, stateClass(tileStateOf(status)), toilet.averageRating);
            el.setAttribute("aria-label", `${toilet.name}, ${openStatusLabel(t, status, "full")}`);
            el.addEventListener("click", () => onSelectToilet(toilet));
            const overlay = new maps.CustomOverlay({
                position: new maps.LatLng(toilet.latitude, toilet.longitude),
                content: el,
                xAnchor: 0.5,
                yAnchor: 1,
                zIndex: 10,
                clickable: true,
            });
            overlay.setMap(map);
            next.push({ overlay, el, toiletId: toilet.id });
        }
        pinsRef.current = next;
    }, [ready, toilets, onSelectToilet, t]);

    // 3b) 선택된 마커: 먹색 외곽선 + 위로 (선택은 색이 아니라 외곽선으로 표시)
    useEffect(() => {
        if (!ready) return;
        for (const { overlay, el, toiletId } of pinsRef.current) {
            const selected = toiletId === selectedId;
            el.setAttribute("aria-pressed", String(selected));
            overlay.setZIndex(selected ? 100 : 10);
        }
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
                {!ready && !error && (
                    <Stack direction="row" spacing={1} alignItems="center" role="status" sx={{ position: "absolute", top: 16, left: 16 }}>
                        <CircularProgress size={18} color="inherit" />
                        <span>{t("map.loading")}</span>
                    </Stack>
                )}
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

/** 상태 안내판 조각 마커 — 스타일은 app.css 의 .pin 과 .state--* . 평점이 있으면 오른쪽에 작게. */
function createPinElement(label: string, stateCls: string, rating: number | null): HTMLButtonElement {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `pin ${stateCls}`;
    el.textContent = label;
    if (rating !== null && rating !== undefined) {
        const r = document.createElement("span");
        r.className = "pin-rating";
        r.textContent = `★${rating.toFixed(1)}`;
        el.appendChild(r);
    }
    return el;
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
