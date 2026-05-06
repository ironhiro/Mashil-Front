import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack } from "@mui/material";
import { loadKakaoMaps } from "../lib/kakaoMap";
import type { LatLng as Coord, ToiletNear } from "../api";

interface Props {
    center: Coord;
    radiusM: number;
    toilets: ToiletNear[];
    selectedId: number | null;
    onSearchAtCenter: (center: Coord) => void;
    onSelectToilet: (t: ToiletNear) => void;
    /** 길찾기 polyline 의 출발점. null 이면 polyline 안 그림. */
    routeFrom: Coord | null;
    /** 길찾기 polyline 의 도착점 (보통 선택된 화장실 좌표). null 이면 polyline 안 그림. */
    routeTo: Coord | null;
}

/** Kakao 지도 + 검색 반경 원 + 커스텀 화장실 마커 + 길찾기 polyline. */
export function MapView({
    center,
    radiusM,
    toilets,
    selectedId,
    onSearchAtCenter,
    onSelectToilet,
    routeFrom,
    routeTo,
}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<kakao.maps.Map | null>(null);
    const markersRef = useRef<{
        marker: kakao.maps.Marker;
        overlay: kakao.maps.CustomOverlay | null;
        toiletId: number;
    }[]>([]);
    const markerImagesRef = useRef<{ normal: kakao.maps.MarkerImage; selected: kakao.maps.MarkerImage } | null>(null);
    const radiusCircleRef = useRef<kakao.maps.Circle | null>(null);
    const routeLineRef = useRef<kakao.maps.Polyline | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

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

                // 커스텀 마커 이미지 — 일반(forest sage) / 선택(amber, 살짝 큼)
                markerImagesRef.current = {
                    normal: new maps.MarkerImage(
                        "/marker-toilet.svg",
                        new maps.Size(36, 46),
                        { offset: new maps.Point(18, 46) },
                    ),
                    selected: new maps.MarkerImage(
                        "/marker-toilet-selected.svg",
                        new maps.Size(44, 56),
                        { offset: new maps.Point(22, 56) },
                    ),
                };

                radiusCircleRef.current = new maps.Circle({
                    center: initialLatLng,
                    radius: radiusM,
                    strokeWeight: 2,
                    strokeColor: "#2D6A4F",
                    strokeOpacity: 0.9,
                    strokeStyle: "shortdash",
                    fillColor: "#52B788",
                    fillOpacity: 0.08,
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

    // 3) toilets 변경 시 마커 + 평점 뱃지 overlay 다시 그리기.
    useEffect(() => {
        if (!ready || !mapRef.current || !markerImagesRef.current) return;
        const map = mapRef.current;
        const maps = window.kakao.maps;
        const images = markerImagesRef.current;

        // 기존 마커 + overlay 정리
        markersRef.current.forEach((m) => {
            m.marker.setMap(null);
            m.overlay?.setMap(null);
        });
        markersRef.current = [];

        const next: typeof markersRef.current = [];
        for (const t of toilets) {
            if (t.latitude == null || t.longitude == null) continue;
            const latlng = new maps.LatLng(t.latitude, t.longitude);
            const marker = new maps.Marker({
                position: latlng,
                map,
                title: t.name,
                image: images.normal,
            });
            maps.event.addListener(marker, "click", () => onSelectToilet(t));

            // 평점이 있을 때만 뱃지 overlay 표시. 댓글 수 0 이면 괄호 생략.
            let overlay: kakao.maps.CustomOverlay | null = null;
            if (t.averageRating !== null && t.averageRating !== undefined) {
                overlay = new maps.CustomOverlay({
                    position: latlng,
                    content: createRatingBadge(t.averageRating, t.commentCount),
                    xAnchor: 0.5,
                    yAnchor: 1,
                    zIndex: 50,
                    clickable: false,
                });
                overlay.setMap(map);
            }

            next.push({ marker, overlay, toiletId: t.id });
        }
        markersRef.current = next;
    }, [ready, toilets, onSelectToilet]);

    // 3b) selectedId 변경 시 해당 마커만 selected 이미지로 swap (selected 마커는 zIndex 높여 위에 표시)
    useEffect(() => {
        if (!ready || !markerImagesRef.current) return;
        const images = markerImagesRef.current;
        for (const { marker, toiletId } of markersRef.current) {
            const isSelected = toiletId === selectedId;
            marker.setImage(isSelected ? images.selected : images.normal);
            marker.setZIndex(isSelected ? 100 : 1);
        }
    }, [ready, selectedId, toilets]);

    // 4) 길찾기 polyline — routeFrom + routeTo 둘 다 있을 때만 그림
    useEffect(() => {
        if (!ready) return;
        const maps = window.kakao.maps;
        // 기존 라인 제거
        routeLineRef.current?.setMap(null);
        routeLineRef.current = null;

        if (!routeFrom || !routeTo || !mapRef.current) return;
        const line = new maps.Polyline({
            path: [
                new maps.LatLng(routeFrom.lat, routeFrom.lng),
                new maps.LatLng(routeTo.lat, routeTo.lng),
            ],
            strokeWeight: 4,
            strokeColor: "#FB8500", // secondary.dark — 핀과 톤 맞춤
            strokeOpacity: 0.9,
            strokeStyle: "solid",
        });
        line.setMap(mapRef.current);
        routeLineRef.current = line;
    }, [ready, routeFrom?.lat, routeFrom?.lng, routeTo?.lat, routeTo?.lng]);

    return (
        <Stack spacing={1}>
            <Box
                ref={containerRef}
                sx={{
                    width: "100%",
                    height: { xs: 360, sm: 480 },
                    borderRadius: 2,
                    overflow: "hidden",
                    bgcolor: "grey.100",
                }}
            />
            {error && <Alert severity="error">{error}</Alert>}
            {!ready && !error && (
                <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <span>지도 로딩 중…</span>
                </Stack>
            )}
            {ready && (
                <Button
                    variant="outlined"
                    onClick={() => {
                        const c = mapRef.current!.getCenter();
                        onSearchAtCenter({ lat: c.getLat(), lng: c.getLng() });
                    }}
                >
                    이 지역에서 다시 검색
                </Button>
            )}
        </Stack>
    );
}

/**
 * 반경(미터) → Kakao 지도 줌 레벨. 작을수록 확대.
 * 직경 = 2*R 이 viewport 안에 살짝 여유를 두고 들어가는 레벨로 매핑.
 * Kakao 레벨별 대략 가시 폭: L5 ~1km · L6 ~2km · L7 ~5km · L8 ~10km · L9 ~20km.
 */
function levelForRadius(radiusM: number): number {
    if (radiusM <= 500) return 5;
    if (radiusM <= 1000) return 6;
    if (radiusM <= 2000) return 7;
    if (radiusM <= 3000) return 7;
    if (radiusM <= 5000) return 8;
    return 9; // 10km+
}

/**
 * 평점 뱃지 div 생성 — 마커 위에 떠 있는 작은 chip.
 * 형식: "★ 4.8" + (commentCount>0 일 때) " (N)".
 * yAnchor=1 + transform translateY(-50px) 로 마커 핀(46px) 위에 띄움.
 */
function createRatingBadge(avgRating: number, commentCount: number): HTMLDivElement {
    const div = document.createElement("div");
    const rating = avgRating.toFixed(1);
    const counts = commentCount > 0 ? ` (${commentCount})` : "";
    div.textContent = `★ ${rating}${counts}`;
    div.style.cssText = `
        background: #FFFFFF;
        border: 1.5px solid #2D6A4F;
        color: #2D6A4F;
        border-radius: 12px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
        transform: translateY(-50px);
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Pretendard, sans-serif;
    `;
    return div;
}
